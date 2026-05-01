#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const QA_MARKER = "qa_passport_first_stamp_v1";
const QA_PLACE_ID = "qa-passport-first-stamp-stop-v1";
const QA_CANONICAL_KEY = "qa_passport_first_stamp_v1";
const FIRST_STAMP_KEY = "first_stamp";

const DEFAULTS = {
  mode: "seed",
  userId: process.env.QA_PASSPORT_USER_ID || "",
  dryRun: false,
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const [rawKey, inlineValue] = token.replace(/^--/, "").split("=");
    const key = rawKey.trim();
    const nextValue = inlineValue != null ? inlineValue : argv[i + 1];
    const hasSeparateValue = inlineValue == null && nextValue && !nextValue.startsWith("--");

    if (key === "dry-run") {
      options.dryRun = true;
      continue;
    }

    if (key === "mode") {
      const value = (inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : "").trim();
      if (hasSeparateValue) i += 1;
      if (value === "seed" || value === "cleanup") {
        options.mode = value;
      }
      continue;
    }

    if (key === "user-id") {
      const value = (inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : "").trim();
      if (hasSeparateValue) i += 1;
      options.userId = value;
      continue;
    }
  }

  return options;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function ensureUserId(userId) {
  if (!userId || !isUuid(userId)) {
    throw new Error(
      "Missing valid user id. Pass --user-id <uuid> or set QA_PASSPORT_USER_ID in .env."
    );
  }
  return userId;
}

async function createClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "blame-travis-qa-passport-first-stamp" } },
  });
}

function buildStampRow(userId) {
  const nowIso = new Date().toISOString();
  return {
    user_id: userId,
    place_id: QA_PLACE_ID,
    canonical_key: QA_CANONICAL_KEY,
    title: "QA First Stamp Stop",
    city: "Austin",
    country_code: "US",
    lat: 30.2672,
    lng: -97.7431,
    source: "proximity_auto",
    day_index: 1,
    day_total_stops: 1,
    day_stamped_count_at_stamp: 1,
    distance_meters: 45.5,
    stamped_at: nowIso,
  };
}

function buildAchievementRow(userId) {
  const nowIso = new Date().toISOString();
  return {
    user_id: userId,
    achievement_key: FIRST_STAMP_KEY,
    metadata_json: {
      qa_marker: QA_MARKER,
      source: "scripts/qa-passport-first-stamp.cjs",
      scenario: "first-earned-stamp-ui",
      totalStampedStops: 1,
      uniqueCountries: 1,
      completedDayCount: 1,
      threshold: 1,
      group: "journey",
    },
    unlocked_at: nowIso,
  };
}

async function seed(client, userId) {
  const stampRow = buildStampRow(userId);

  const { data: existingStamp, error: existingStampError } = await client
    .from("passport_stamps")
    .select("id")
    .eq("user_id", userId)
    .eq("place_id", QA_PLACE_ID)
    .maybeSingle();
  if (existingStampError) throw existingStampError;

  if (!existingStamp) {
    const { error: stampInsertError } = await client.from("passport_stamps").insert(stampRow);
    if (stampInsertError) throw stampInsertError;
  }

  const { data: existingAchievement, error: achievementFetchError } = await client
    .from("user_achievements")
    .select("id,metadata_json")
    .eq("user_id", userId)
    .eq("achievement_key", FIRST_STAMP_KEY)
    .maybeSingle();
  if (achievementFetchError) throw achievementFetchError;

  let achievementStatus = "inserted";
  if (!existingAchievement) {
    const { error: achievementInsertError } = await client
      .from("user_achievements")
      .insert(buildAchievementRow(userId));
    if (achievementInsertError) throw achievementInsertError;
  } else {
    const metadata = existingAchievement.metadata_json || {};
    if (metadata.qa_marker === QA_MARKER) {
      achievementStatus = "already_seeded";
    } else {
      achievementStatus = "already_present_user_data";
    }
  }

  return {
    stampStatus: existingStamp ? "already_seeded" : "inserted",
    achievementStatus,
  };
}

async function cleanup(client, userId) {
  const { data: deletedStamps, error: stampDeleteError } = await client
    .from("passport_stamps")
    .delete()
    .eq("user_id", userId)
    .eq("place_id", QA_PLACE_ID)
    .select("id");
  if (stampDeleteError) throw stampDeleteError;

  const { data: achievements, error: achievementFetchError } = await client
    .from("user_achievements")
    .select("id,metadata_json")
    .eq("user_id", userId)
    .eq("achievement_key", FIRST_STAMP_KEY);
  if (achievementFetchError) throw achievementFetchError;

  const qaAchievementIds = (achievements || [])
    .filter((row) => (row.metadata_json || {}).qa_marker === QA_MARKER)
    .map((row) => row.id);

  let deletedAchievementsCount = 0;
  if (qaAchievementIds.length) {
    const { data: deletedAchievements, error: achievementDeleteError } = await client
      .from("user_achievements")
      .delete()
      .in("id", qaAchievementIds)
      .select("id");
    if (achievementDeleteError) throw achievementDeleteError;
    deletedAchievementsCount = (deletedAchievements || []).length;
  }

  return {
    deletedStampsCount: (deletedStamps || []).length,
    deletedAchievementsCount,
  };
}

function printUsage() {
  console.log("Usage:");
  console.log("npm run qa:seed:passport-first-stamp -- --user-id <uuid>");
  console.log("npm run qa:cleanup:passport-first-stamp -- --user-id <uuid>");
  console.log("node scripts/qa-passport-first-stamp.cjs --mode seed --user-id <uuid>");
  console.log("Optional: set QA_PASSPORT_USER_ID in .env");
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  const userId = ensureUserId(options.userId);

  console.log(`[qa-passport-first-stamp] Mode: ${options.mode}`);
  console.log(`[qa-passport-first-stamp] User: ${userId}`);
  console.log(`[qa-passport-first-stamp] Dry run: ${options.dryRun ? "yes" : "no"}`);

  if (options.dryRun) {
    console.log("[qa-passport-first-stamp] Planned rows:");
    console.log(`- passport_stamps.place_id = ${QA_PLACE_ID}`);
    console.log(`- user_achievements.achievement_key = ${FIRST_STAMP_KEY} (qa marker scoped)`);
    return;
  }

  const client = await createClient();
  if (options.mode === "seed") {
    const result = await seed(client, userId);
    console.log(
      `[qa-passport-first-stamp] Seed complete. stamp=${result.stampStatus}, achievement=${result.achievementStatus}`
    );
    if (result.achievementStatus === "already_present_user_data") {
      console.log(
        "[qa-passport-first-stamp] Note: user already has non-QA first_stamp achievement; cleanup will not remove it."
      );
    }
  } else {
    const result = await cleanup(client, userId);
    console.log(
      `[qa-passport-first-stamp] Cleanup complete. deleted_stamps=${result.deletedStampsCount}, deleted_qa_achievements=${result.deletedAchievementsCount}`
    );
  }
}

main().catch((error) => {
  console.error(`[qa-passport-first-stamp] FAILED: ${error.message}`);
  process.exit(1);
});

