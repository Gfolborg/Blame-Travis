import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

import {
  buildNotificationContent,
  createNotificationPayload,
  NotificationEventType,
  shiftOutOfQuietHours,
} from "../../../shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EDGE_CRON_SECRET = Deno.env.get("EDGE_CRON_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ProfileRow {
  id: string;
  notifications_enabled: boolean;
}

interface AdventureRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  drop_date: string;
  deadline: string;
}

interface DeviceRow {
  profile_id: string;
  expo_push_token: string | null;
  permission_status: string;
  disabled_at: string | null;
  last_seen_at: string | null;
}

interface DeliveryRow {
  dedupe_key: string;
}

type Candidate = {
  dedupeKey: string;
  type: NotificationEventType;
  profileId: string;
  adventureId?: string;
  scheduledFor: Date;
};

function atLocalTime(base: Date, hour: number, minute = 0) {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function buildAdventureCandidates(adventure: AdventureRow, now: Date): Candidate[] {
  const createdAt = new Date(adventure.created_at);
  const dropDate = new Date(adventure.drop_date);
  const deadline = new Date(adventure.deadline);
  const items: Candidate[] = [];

  if (adventure.status === "draft") {
    items.push({
      dedupeKey: `draft_ready:${adventure.id}`,
      type: "draft_ready",
      profileId: adventure.user_id,
      adventureId: adventure.id,
      scheduledFor: shiftOutOfQuietHours(new Date(createdAt.getTime() + 90 * 60 * 1000)),
    });

    items.push({
      dedupeKey: `draft_stale:${adventure.id}`,
      type: "draft_stale",
      profileId: adventure.user_id,
      adventureId: adventure.id,
      scheduledFor: shiftOutOfQuietHours(atLocalTime(new Date(createdAt.getTime() + 24 * 60 * 60 * 1000), 10)),
    });
  }

  if (adventure.status === "active") {
    items.push({
      dedupeKey: `adventure_prep:${adventure.id}`,
      type: "adventure_prep",
      profileId: adventure.user_id,
      adventureId: adventure.id,
      scheduledFor: shiftOutOfQuietHours(atLocalTime(new Date(dropDate.getTime() - 24 * 60 * 60 * 1000), 18)),
    });
    items.push({
      dedupeKey: `adventure_day_of:${adventure.id}`,
      type: "adventure_day_of",
      profileId: adventure.user_id,
      adventureId: adventure.id,
      scheduledFor: shiftOutOfQuietHours(atLocalTime(dropDate, 9)),
    });
    items.push({
      dedupeKey: `adventure_overdue:${adventure.id}`,
      type: "adventure_overdue",
      profileId: adventure.user_id,
      adventureId: adventure.id,
      scheduledFor: shiftOutOfQuietHours(atLocalTime(dropDate, 18)),
    });
  }

  if (adventure.status === "missed") {
    items.push({
      dedupeKey: `adventure_missed:${adventure.id}`,
      type: "adventure_missed",
      profileId: adventure.user_id,
      adventureId: adventure.id,
      scheduledFor: shiftOutOfQuietHours(atLocalTime(new Date(deadline.getTime() + 24 * 60 * 60 * 1000), 10)),
    });
  }

  if (adventure.status === "completed") {
    items.push({
      dedupeKey: `adventure_completed:${adventure.id}`,
      type: "adventure_completed",
      profileId: adventure.user_id,
      adventureId: adventure.id,
      scheduledFor: now,
    });
  }

  return items;
}

async function getLatestSeenMap() {
  const { data, error } = await supabase
    .from("notification_devices")
    .select("profile_id,last_seen_at,expo_push_token,permission_status,disabled_at");

  if (error) throw error;

  const latestSeenByProfile = new Map<string, DeviceRow[]>();
  (data as DeviceRow[]).forEach((row) => {
    const items = latestSeenByProfile.get(row.profile_id) ?? [];
    items.push(row);
    latestSeenByProfile.set(row.profile_id, items);
  });

  return latestSeenByProfile;
}

async function sendExpoPush(message: Record<string, unknown>) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Expo push failed with ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!EDGE_CRON_SECRET) {
      return new Response(JSON.stringify({ error: "SERVER_MISCONFIGURED" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const providedSecret = req.headers.get("x-edge-cron-secret") ?? "";
    if (providedSecret !== EDGE_CRON_SECRET) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();

    const [{ data: profiles, error: profileError }, { data: adventures, error: adventureError }, { data: deliveries, error: deliveryError }] = await Promise.all([
      supabase.from("profiles").select("id,notifications_enabled").eq("notifications_enabled", true),
      supabase.from("adventures").select("id,user_id,status,created_at,drop_date,deadline"),
      supabase.from("notification_deliveries").select("dedupe_key"),
    ]);

    if (profileError) throw profileError;
    if (adventureError) throw adventureError;
    if (deliveryError) throw deliveryError;

    const enabledProfiles = new Set((profiles as ProfileRow[]).map((profile) => profile.id));
    const existingDedupeKeys = new Set((deliveries as DeliveryRow[]).map((delivery) => delivery.dedupe_key));
    const devicesByProfile = await getLatestSeenMap();

    const candidates: Candidate[] = [];
    (adventures as AdventureRow[]).forEach((adventure) => {
      if (!enabledProfiles.has(adventure.user_id)) return;
      buildAdventureCandidates(adventure, now).forEach((candidate) => {
        if (candidate.scheduledFor.getTime() <= now.getTime() && !existingDedupeKeys.has(candidate.dedupeKey)) {
          candidates.push(candidate);
        }
      });
    });

    for (const profile of profiles as ProfileRow[]) {
      const profileDevices = devicesByProfile.get(profile.id) ?? [];
      const latestSeen = profileDevices
        .map((device) => device.last_seen_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);

      const hasOpenAdventure = (adventures as AdventureRow[]).some(
        (adventure) => adventure.user_id === profile.id && ["draft", "assigned", "active"].includes(adventure.status),
      );

      if (hasOpenAdventure || !latestSeen) continue;

      const lastSeenAt = new Date(latestSeen);
      const daysSinceSeen = now.getTime() - lastSeenAt.getTime();
      if (daysSinceSeen < 7 * 24 * 60 * 60 * 1000) continue;

      const idleDedupeKey = `idle_nudge:${profile.id}:${lastSeenAt.toISOString().slice(0, 10)}`;
      if (existingDedupeKeys.has(idleDedupeKey)) continue;

      const idleTime = shiftOutOfQuietHours(atLocalTime(now, 11));
      if (idleTime.getTime() > now.getTime()) continue;

      candidates.push({
        dedupeKey: idleDedupeKey,
        type: "idle_nudge",
        profileId: profile.id,
        scheduledFor: idleTime,
      });
    }

    const results = [];

    for (const candidate of candidates) {
      const devices = (devicesByProfile.get(candidate.profileId) ?? []).filter(
        (device) =>
          device.expo_push_token &&
          device.permission_status === "granted" &&
          !device.disabled_at,
      );

      const content = buildNotificationContent(candidate.type, {
        adventureId: candidate.adventureId,
      });

      const deliveryInsert = {
        dedupe_key: candidate.dedupeKey,
        profile_id: candidate.profileId,
        adventure_id: candidate.adventureId ?? null,
        type: candidate.type,
        channel: "push",
        title: content.title,
        body: content.body,
        scheduled_for: candidate.scheduledFor.toISOString(),
        status: devices.length > 0 ? "pending" : "skipped",
        failure_reason: devices.length > 0 ? null : "No active devices with push permissions",
      };

      const { error: insertError } = await supabase.from("notification_deliveries").insert(deliveryInsert);
      if (insertError) {
        results.push({ dedupeKey: candidate.dedupeKey, status: "insert_failed", error: insertError.message });
        continue;
      }

      if (devices.length === 0) {
        results.push({ dedupeKey: candidate.dedupeKey, status: "skipped" });
        continue;
      }

      try {
        await Promise.all(
          devices.map((device) =>
            sendExpoPush({
              to: device.expo_push_token,
              title: content.title,
              body: content.body,
              data: createNotificationPayload(candidate.type, {
                adventureId: candidate.adventureId,
              }),
              sound: "default",
            }),
          ),
        );

        await supabase
          .from("notification_deliveries")
          .update({ status: "sent", sent_at: now.toISOString() })
          .eq("dedupe_key", candidate.dedupeKey);

        results.push({ dedupeKey: candidate.dedupeKey, status: "sent" });
      } catch (error) {
        await supabase
          .from("notification_deliveries")
          .update({
            status: "failed",
            failure_reason: error instanceof Error ? error.message : String(error),
          })
          .eq("dedupe_key", candidate.dedupeKey);

        results.push({ dedupeKey: candidate.dedupeKey, status: "failed" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
