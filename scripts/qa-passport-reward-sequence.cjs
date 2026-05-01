#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const QA_MARKER = "qa_passport_reward_sequence_v1";
const DEFAULT_REWARD_COUNT = 2;
const CANDIDATE_KEYS = [
  "first_stamp",
  "first_abroad",
  "places_5",
  "places_10",
  "places_25",
  "places_50",
  "places_100",
  "countries_2",
  "countries_5",
  "countries_10",
  "days_completed_1",
  "days_completed_5",
  "days_completed_10",
];

const DEFAULTS = {
  mode: "seed",
  userId: process.env.QA_PASSPORT_USER_ID || "",
  count: DEFAULT_REWARD_COUNT,
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

    if (key === "count") {
      const value = Number((inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : "").trim());
      if (hasSeparateValue) i += 1;
      if (Number.isFinite(value) && value > 0) {
        options.count = Math.max(1, Math.min(5, Math.floor(value)));
      }
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
    throw new Error("Missing valid user id. Pass --user-id <uuid> or set QA_PASSPORT_USER_ID in .env.");
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
    global: { headers: { "x-application-name": "blame-travis-qa-passport-reward-sequence" } },
  });
}

async function listUserAchievements(client, userId) {
  const { data, error } = await client
    .from("user_achievements")
    .select("id,achievement_key,metadata_json")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

function pickSeedKeys(existingRows, count) {
  const existingKeys = new Set(existingRows.map((row) => row.achievement_key));
  return CANDIDATE_KEYS.filter((key) => !existingKeys.has(key)).slice(0, count);
}

function buildRows(userId, keys) {
  const now = Date.now();
  return keys.map((key, index) => ({
    user_id: userId,
    achievement_key: key,
    metadata_json: {
      qa_marker: QA_MARKER,
      source: "scripts/qa-passport-reward-sequence.cjs",
      scenario: "global-stamp-reward-sequence",
      order: index + 1,
    },
    unlocked_at: new Date(now + index * 1000).toISOString(),
  }));
}

async function seed(client, userId, count) {
  const existingRows = await listUserAchievements(client, userId);
  const keysToSeed = pickSeedKeys(existingRows, count);
  if (keysToSeed.length < count) {
    throw new Error(
      `Unable to seed ${count} rewards. Only ${keysToSeed.length} unearned achievement key(s) available for this user.`
    );
  }

  const rows = buildRows(userId, keysToSeed);
  const { data, error } = await client.from("user_achievements").insert(rows).select("id,achievement_key");
  if (error) throw error;
  return {
    insertedCount: (data || []).length,
    keys: keysToSeed,
  };
}

async function cleanup(client, userId) {
  const existingRows = await listUserAchievements(client, userId);
  const qaIds = existingRows
    .filter((row) => (row.metadata_json || {}).qa_marker === QA_MARKER)
    .map((row) => row.id);

  if (!qaIds.length) {
    return { deletedCount: 0 };
  }

  const { data, error } = await client.from("user_achievements").delete().in("id", qaIds).select("id");
  if (error) throw error;
  return { deletedCount: (data || []).length };
}

function printUsage() {
  console.log("Usage:");
  console.log("npm run qa:seed:passport-reward-sequence -- --user-id <uuid>");
  console.log("npm run qa:cleanup:passport-reward-sequence -- --user-id <uuid>");
  console.log("node scripts/qa-passport-reward-sequence.cjs --mode seed --user-id <uuid> --count 2");
  console.log("Optional: set QA_PASSPORT_USER_ID in .env");
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  const userId = ensureUserId(options.userId);

  console.log(`[qa-passport-reward-sequence] Mode: ${options.mode}`);
  console.log(`[qa-passport-reward-sequence] User: ${userId}`);
  console.log(`[qa-passport-reward-sequence] Count: ${options.count}`);
  console.log(`[qa-passport-reward-sequence] Dry run: ${options.dryRun ? "yes" : "no"}`);

  const client = await createClient();
  if (options.dryRun) {
    const existingRows = await listUserAchievements(client, userId);
    const keysToSeed = pickSeedKeys(existingRows, options.count);
    console.log("[qa-passport-reward-sequence] Planned keys:");
    if (!keysToSeed.length) {
      console.log("- none available");
    } else {
      keysToSeed.forEach((key, i) => console.log(`- ${i + 1}. ${key}`));
    }
    return;
  }

  if (options.mode === "seed") {
    const result = await seed(client, userId, options.count);
    console.log(
      `[qa-passport-reward-sequence] Seed complete. inserted=${result.insertedCount}, keys=${result.keys.join(",")}`
    );
  } else {
    const result = await cleanup(client, userId);
    console.log(`[qa-passport-reward-sequence] Cleanup complete. deleted_qa_achievements=${result.deletedCount}`);
  }
}

main().catch((error) => {
  console.error(`[qa-passport-reward-sequence] FAILED: ${error.message}`);
  process.exit(1);
});

