import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Surface = "details" | "journeys" | "explore";
type PlacementSurface = "explore_card" | "details_primary_cta" | "journeys_stop_cta";
type AffiliateEventName =
  | "affiliate_impression"
  | "affiliate_click"
  | "affiliate_handoff_started"
  | "affiliate_handoff_returned"
  | "affiliate_booking_reported"
  | "affiliate_commission_confirmed";

type Actor = { userId: string | null; guestId: string | null };

type ActiveOfferRow = {
  id: string;
  partner_id: string;
  title: string;
  status: string;
  tracking_template: string;
  valid_from: string;
  valid_to: string | null;
  partner: {
    id: string;
    name: string;
    status: string;
    disclosure_label: string;
  } | null;
};

type PlacementRow = {
  id: string;
  placement_key: string;
  active: boolean;
  surface: PlacementSurface;
  disclosure_required: boolean;
};

type HandoffBuildInput = {
  trackingTemplate: string;
  activityId: string;
  offerId: string;
  partnerId: string;
  sessionId: string;
  placementKey: string;
  timestampIso: string;
};

interface AffiliateAdapter {
  buildHandoffUrl(input: HandoffBuildInput): string;
}

class MockAffiliateAdapter implements AffiliateAdapter {
  buildHandoffUrl(input: HandoffBuildInput): string {
    const fallbackBase = "https://partner.example.com/book";
    const template = (input.trackingTemplate || "").trim() || fallbackBase;
    const base = template.includes("://") ? template : fallbackBase;
    const url = new URL(base);

    url.searchParams.set("activity_id", input.activityId);
    url.searchParams.set("offer_id", input.offerId);
    url.searchParams.set("partner_id", input.partnerId);
    url.searchParams.set("session_id", input.sessionId);
    url.searchParams.set("placement_key", input.placementKey);
    url.searchParams.set("ts", input.timestampIso);
    return url.toString();
  }
}

const adapter: AffiliateAdapter = new MockAffiliateAdapter();

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeActivityKey = (activityId: string): string =>
  activityId.startsWith("provider:") ? activityId.replace("provider:", "") : activityId;

const getAuthUserId = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user?.id || null;
};

const resolveActor = async (req: Request, payload: any): Promise<Actor> => {
  const userId = await getAuthUserId(req);
  const guestId = typeof payload?.guestId === "string" && payload.guestId.trim() ? payload.guestId.trim() : null;
  if (!userId && !guestId) {
    throw new Error("MISSING_ACTOR");
  }
  return { userId, guestId };
};

const resolveActivityId = async (activityId: string): Promise<string | null> => {
  if (!activityId) return null;
  if (isUuid(activityId)) return activityId;
  const canonicalKey = normalizeActivityKey(activityId);
  const { data, error } = await supabase
    .from("activities")
    .select("id")
    .eq("canonical_key", canonicalKey)
    .single();
  if (error) return null;
  return data?.id || null;
};

const resolvePlacement = async (placementKey: string): Promise<PlacementRow | null> => {
  const { data, error } = await supabase
    .from("affiliate_placements")
    .select("id,placement_key,active,surface,disclosure_required")
    .eq("placement_key", placementKey)
    .eq("active", true)
    .single();
  if (error) return null;
  return (data || null) as PlacementRow | null;
};

const resolveActiveOffer = async (offerId?: string | null): Promise<ActiveOfferRow | null> => {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("affiliate_offers")
    .select(
      "id,partner_id,title,status,tracking_template,valid_from,valid_to,partner:affiliate_partners(id,name,status,disclosure_label)",
    )
    .eq("status", "active")
    .lte("valid_from", nowIso)
    .or(`valid_to.is.null,valid_to.gt.${nowIso}`)
    .order("valid_from", { ascending: false })
    .limit(1);

  if (offerId) {
    query = query.eq("id", offerId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as ActiveOfferRow;
  if (!row.partner || row.partner.status !== "active") return null;
  return row;
};

const createSupersedeFilter = (actor: Actor) =>
  actor.userId ? `user_id.eq.${actor.userId}` : `guest_id.eq.${actor.guestId}`;

const applyAttributionPrecedence = async (
  actor: Actor,
  sessionId: string,
  activityId: string,
  surface: Surface,
) => {
  const actorFilter = createSupersedeFilter(actor);
  const { data } = await supabase
    .from("affiliate_attributions")
    .select("id,source_surface,attribution_status")
    .eq("session_id", sessionId)
    .eq("activity_id", activityId)
    .or(actorFilter);

  const existing = data || [];
  const hasDetails = existing.some((row: any) => row.source_surface === "details" && row.attribution_status !== "superseded");
  const hasExplore = existing.some((row: any) => row.source_surface === "explore" && row.attribution_status !== "superseded");
  if (surface === "explore" && hasDetails) {
    return "superseded" as const;
  }

  if (surface === "details" && hasExplore) {
    const exploreIds = existing
      .filter((row: any) => row.source_surface === "explore" && row.attribution_status !== "superseded")
      .map((row: any) => row.id);
    if (exploreIds.length) {
      await supabase.from("affiliate_attributions").update({ attribution_status: "superseded" }).in("id", exploreIds);
    }
  }
  return "attributed" as const;
};

const isDuplicateClick = async (
  actor: Actor,
  offerId: string,
  activityId: string,
  surface: Surface,
): Promise<boolean> => {
  const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  let query = supabase
    .from("affiliate_attributions")
    .select("id")
    .eq("offer_id", offerId)
    .eq("activity_id", activityId)
    .eq("source_surface", surface)
    .gte("click_ts", sinceIso)
    .limit(1);

  if (actor.userId) query = query.eq("user_id", actor.userId);
  else query = query.eq("guest_id", actor.guestId as string);

  const { data, error } = await query;
  if (error) return false;
  return Boolean(data?.length);
};

const assertAffiliatePayloadFields = (payload: any) => {
  const requiredTextFields = ["copyVariant", "placementKey", "disclosureWording"];
  for (const key of requiredTextFields) {
    if (typeof payload?.[key] !== "string" || !payload[key].trim()) {
      throw new Error(`MISSING_${key.toUpperCase()}`);
    }
  }
  if (!Object.prototype.hasOwnProperty.call(payload, "partnerBrand")) {
    throw new Error("MISSING_PARTNERBRAND");
  }
};

const handleResolveOffer = async (payload: any) => {
  const placementKey = String(payload?.placementKey || "");
  if (!placementKey) return json(400, { ok: false, reason: "MISSING_PLACEMENT_KEY" });

  const placement = await resolvePlacement(placementKey);
  if (!placement) return json(404, { ok: false, reason: "PLACEMENT_NOT_ACTIVE", placementKey });

  const offer = await resolveActiveOffer(payload?.offerId || null);
  if (!offer) {
    return json(200, {
      ok: false,
      reason: "NO_ACTIVE_OFFER",
      offer: null,
      placementKey,
      disclosureWording: null,
    });
  }

  return json(200, {
    ok: true,
    offer: {
      id: offer.id,
      partnerId: offer.partner_id,
      partnerName: offer.partner?.name ?? "Partner",
      title: offer.title,
      status: offer.status,
      commissionModel: "cpa",
      trackingTemplate: offer.tracking_template,
      validFrom: offer.valid_from,
      validTo: offer.valid_to,
    },
    placementKey,
    disclosureWording: offer.partner?.disclosure_label ?? "Partner offer",
  });
};

const handleCreateHandoff = async (req: Request, payload: any) => {
  assertAffiliatePayloadFields(payload);
  const actor = await resolveActor(req, payload);

  const activityIdInput = String(payload?.activityId || "");
  const offerId = String(payload?.offerId || "");
  const sessionId = String(payload?.sessionId || "");
  const surface = String(payload?.surface || "") as Surface;
  const placementKey = String(payload?.placementKey || "");
  const partnerBrand = payload?.partnerBrand;
  const disclosureWording = String(payload?.disclosureWording || "");

  if (!activityIdInput || !offerId || !sessionId || !surface || !placementKey || !disclosureWording) {
    return json(400, { ok: false, reason: "MISSING_REQUIRED_FIELDS" });
  }

  const activityId = await resolveActivityId(activityIdInput);
  if (!activityId) return json(404, { ok: false, reason: "ACTIVITY_NOT_FOUND" });

  const placement = await resolvePlacement(placementKey);
  if (!placement) return json(404, { ok: false, reason: "PLACEMENT_NOT_ACTIVE" });

  const offer = await resolveActiveOffer(offerId);
  if (!offer) return json(404, { ok: false, reason: "OFFER_NOT_ACTIVE" });

  const nowIso = new Date().toISOString();
  const deduped = await isDuplicateClick(actor, offer.id, activityId, surface);
  const attributedStatus = deduped
    ? "superseded"
    : await applyAttributionPrecedence(actor, sessionId, activityId, surface);

  const expiresAt = new Date(Date.now() + ATTRIBUTION_WINDOW_MS).toISOString();
  const handoffUrl = adapter.buildHandoffUrl({
    trackingTemplate: offer.tracking_template,
    activityId,
    offerId: offer.id,
    partnerId: offer.partner_id,
    sessionId,
    placementKey,
    timestampIso: nowIso,
  });

  const insertPayload = {
    event_name: "affiliate_handoff_started",
    user_id: actor.userId,
    guest_id: actor.guestId,
    session_id: sessionId,
    activity_id: activityId,
    offer_id: offer.id,
    partner_id: offer.partner_id,
    placement_id: placement.id,
    attribution_status: attributedStatus,
    click_ts: nowIso,
    expires_at: expiresAt,
    deduped,
    source_surface: surface,
    placement_key: placementKey,
    copy_variant: payload.copyVariant,
    partner_brand: partnerBrand,
    disclosure_wording: disclosureWording,
    destination_city: payload.destinationCity || null,
    metadata: {
      action: "create_handoff",
      partner_brand: partnerBrand,
      disclosure_wording: disclosureWording,
      placement_surface: placement.surface,
    },
  };

  const { data, error } = await supabase
    .from("affiliate_attributions")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) return json(500, { ok: false, reason: error.message });

  return json(200, {
    ok: true,
    handoffUrl,
    attributionId: data?.id || null,
    deduped,
  });
};

const handleTrackEvent = async (req: Request, payload: any) => {
  assertAffiliatePayloadFields(payload);
  const actor = await resolveActor(req, payload);

  const eventName = String(payload?.eventName || "") as AffiliateEventName;
  const sessionId = String(payload?.sessionId || "");
  const activityIdInput = String(payload?.activityId || "");
  const surface = String(payload?.surface || "") as Surface;
  const placementKey = String(payload?.placementKey || "");
  const offerId = String(payload?.offerId || "");
  const partnerId = String(payload?.partnerId || "");

  if (!eventName || !sessionId || !activityIdInput || !surface || !placementKey || !offerId || !partnerId) {
    return json(400, { ok: false, reason: "MISSING_REQUIRED_FIELDS" });
  }

  const activityId = await resolveActivityId(activityIdInput);
  if (!activityId) return json(404, { ok: false, reason: "ACTIVITY_NOT_FOUND" });

  const placement = await resolvePlacement(placementKey);
  if (!placement) return json(404, { ok: false, reason: "PLACEMENT_NOT_ACTIVE" });

  const offer = await resolveActiveOffer(offerId);
  if (!offer || offer.partner_id !== partnerId) {
    return json(404, { ok: false, reason: "INVALID_OFFER_PARTNER" });
  }

  const nowIso = new Date().toISOString();
  const dedupeEvents = new Set<AffiliateEventName>(["affiliate_click", "affiliate_handoff_started"]);
  const deduped = dedupeEvents.has(eventName)
    ? await isDuplicateClick(actor, offer.id, activityId, surface)
    : false;
  const attributionStatus = deduped
    ? "superseded"
    : await applyAttributionPrecedence(actor, sessionId, activityId, surface);

  const expiresAt = new Date(Date.now() + ATTRIBUTION_WINDOW_MS).toISOString();

  const { error } = await supabase.from("affiliate_attributions").insert({
    event_name: eventName,
    user_id: actor.userId,
    guest_id: actor.guestId,
    session_id: sessionId,
    activity_id: activityId,
    offer_id: offer.id,
    partner_id: offer.partner_id,
    placement_id: placement.id,
    attribution_status: attributionStatus,
    click_ts: nowIso,
    expires_at: expiresAt,
    deduped,
    source_surface: surface,
    placement_key: placementKey,
    copy_variant: payload.copyVariant,
    partner_brand: payload.partnerBrand,
    disclosure_wording: payload.disclosureWording,
    destination_city: payload.destinationCity || null,
    metadata: {
      action: "track_event",
      event_name: eventName,
      partner_brand: payload.partnerBrand,
      disclosure_wording: payload.disclosureWording,
    },
  });

  if (error) return json(500, { ok: false, reason: error.message });
  return json(200, { ok: true, deduped });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, reason: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const payload = body?.payload || {};

    if (action === "resolve_offer") return await handleResolveOffer(payload);
    if (action === "create_handoff") return await handleCreateHandoff(req, payload);
    if (action === "track_event") return await handleTrackEvent(req, payload);

    return json(400, { ok: false, reason: "UNKNOWN_ACTION" });
  } catch (error) {
    return json(500, {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
});

