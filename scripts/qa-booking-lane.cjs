#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CITY_CONFIG = {
  austin: { label: "Austin, TX", lat: 30.2672, lng: -97.7431 },
  nyc: { label: "New York, NY", lat: 40.7128, lng: -74.006 },
  miami: { label: "Miami, FL", lat: 25.7617, lng: -80.1918 },
};

const DEFAULTS = {
  mode: "seed",
  cities: Object.keys(CITY_CONFIG),
  dryRun: false,
  confirmPurge: false,
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
      if (value === "seed" || value === "cleanup" || value === "purge") {
        options.mode = value;
      }
      continue;
    }

    if (key === "cities") {
      const value = (inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : "").trim();
      if (hasSeparateValue) i += 1;
      if (value) {
        options.cities = value
          .split(",")
          .map(entry => entry.trim().toLowerCase())
          .filter(Boolean);
      }
      continue;
    }

    if (key === "confirm-purge") {
      const value = (inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : "").trim().toLowerCase();
      if (hasSeparateValue) i += 1;
      options.confirmPurge = value === "yes";
      continue;
    }
  }
  return options;
}

function ensureCities(cities) {
  const deduped = Array.from(new Set(cities));
  const selected = [];
  for (const cityId of deduped) {
    if (!CITY_CONFIG[cityId]) {
      throw new Error(
        `Unknown city '${cityId}'. Allowed values: ${Object.keys(CITY_CONFIG).join(", ")}`
      );
    }
    selected.push(cityId);
  }
  if (!selected.length) {
    throw new Error("No cities selected.");
  }
  return selected;
}

function buildQaRows(selectedCities) {
  return selectedCities.map(cityId => {
    const city = CITY_CONFIG[cityId];
    const canonicalKey = `qa_booking_lane_${cityId}_v1`;
    return {
      canonical_key: canonicalKey,
      title: `QA Booking Lane (${city.label})`,
      summary:
        "Temporary QA-only booking lane for Sprint 4 validation. Disable immediately after QA completes.",
      categories: ["qa", "booking", "test-lane"],
      tags: ["qa", "booking", "temporary"],
      source_priority: "manual",
      status: "active",
      location_city: city.label.split(",")[0],
      location_region: city.label.split(",")[1]?.trim() || null,
      location_country_code: "US",
      location_address_line: `${city.label} - QA Lane`,
      location_lat: city.lat,
      location_lng: city.lng,
      location_timezone: null,
      pricing_tier: "unknown",
      pricing_from_minor: null,
      pricing_to_minor: null,
      pricing_currency: "USD",
      pricing_is_free: false,
      duration_minutes_min: 60,
      duration_minutes_max: 120,
      rating_average: 4.2,
      rating_count: 42,
      review_provider: "manual",
      image_url: null,
      booking_supported: true,
      booking_deep_link: `https://www.viator.com/?qa_booking_lane=${cityId}`,
      accessibility_tags: [],
      family_friendly: true,
    };
  });
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
    global: { headers: { "x-application-name": "blame-travis-qa-booking-lane" } },
  });
}

async function seedRows(client, rows) {
  const { error } = await client.from("activities").upsert(rows, { onConflict: "canonical_key" });
  if (error) throw error;

  const canonicalKeys = rows.map(row => row.canonical_key);
  const { data: activityRows, error: fetchError } = await client
    .from("activities")
    .select("id,canonical_key")
    .in("canonical_key", canonicalKeys);
  if (fetchError) throw fetchError;

  const refRows = (activityRows || []).map(row => ({
    activity_id: row.id,
    provider: "manual",
    provider_ref: row.canonical_key,
    raw_data: {
      source: "scripts/qa-booking-lane.cjs",
      reason: "Sprint 4 QA BOOK NOW coverage",
      seeded_at: new Date().toISOString(),
    },
    last_synced_at: new Date().toISOString(),
  }));

  if (refRows.length) {
    const { error: refsError } = await client
      .from("activity_provider_refs")
      .upsert(refRows, { onConflict: "provider,provider_ref" });
    if (refsError) throw refsError;
  }

  return activityRows?.length || 0;
}

async function cleanupRows(client, rows) {
  const canonicalKeys = rows.map(row => row.canonical_key);
  const nowIso = new Date().toISOString();
  const { data: updatedRows, error } = await client
    .from("activities")
    .update({
      booking_supported: false,
      booking_deep_link: null,
      status: "hidden",
      summary: `QA booking lane disabled at ${nowIso}.`,
    })
    .in("canonical_key", canonicalKeys)
    .select("id");
  if (error) throw error;

  return (updatedRows || []).length;
}

async function purgeRows(client, rows) {
  const canonicalKeys = rows.map(row => row.canonical_key);

  const { data: activityRows, error: fetchError } = await client
    .from("activities")
    .select("id,canonical_key")
    .in("canonical_key", canonicalKeys);
  if (fetchError) throw fetchError;

  const activityIds = (activityRows || []).map(row => row.id);

  if (activityIds.length) {
    const { error: refDeleteError } = await client
      .from("activity_provider_refs")
      .delete()
      .in("activity_id", activityIds)
      .eq("provider", "manual");
    if (refDeleteError) throw refDeleteError;
  }

  const { data: deletedRows, error: activityDeleteError } = await client
    .from("activities")
    .delete()
    .in("canonical_key", canonicalKeys)
    .select("id");
  if (activityDeleteError) throw activityDeleteError;

  return (deletedRows || []).length;
}

function printUsage() {
  console.log("Usage:");
  console.log("npm run qa:seed:booking-lane");
  console.log("npm run qa:seed:booking-lane -- --cities austin");
  console.log("npm run qa:cleanup:booking-lane");
  console.log("npm run qa:purge:booking-lane");
  console.log("node scripts/qa-booking-lane.cjs --mode purge --cities austin --confirm-purge yes");
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  const selectedCities = ensureCities(options.cities);
  const rows = buildQaRows(selectedCities);

  console.log(`[qa-booking-lane] Mode: ${options.mode}`);
  console.log(`[qa-booking-lane] Cities: ${selectedCities.join(", ")}`);
  console.log(`[qa-booking-lane] Dry run: ${options.dryRun}`);
  if (options.mode === "purge") {
    console.log(`[qa-booking-lane] Confirm purge: ${options.confirmPurge ? "yes" : "no"}`);
  }

  if (options.dryRun) {
    console.log("[qa-booking-lane] Dry run rows:");
    for (const row of rows) {
      console.log(`- ${row.canonical_key} (${row.title})`);
    }
    return;
  }

  const client = await createClient();
  if (options.mode === "seed") {
    const count = await seedRows(client, rows);
    console.log(`[qa-booking-lane] Seed complete. Ensured ${count} activity rows.`);
  } else if (options.mode === "cleanup") {
    const count = await cleanupRows(client, rows);
    console.log(`[qa-booking-lane] Cleanup complete. Disabled ${count} activity rows.`);
  } else {
    if (!options.confirmPurge) {
      throw new Error(
        "Purge mode is destructive for QA rows. Re-run with --confirm-purge yes."
      );
    }
    const count = await purgeRows(client, rows);
    console.log(`[qa-booking-lane] Purge complete. Deleted ${count} activity rows.`);
  }
}

main().catch(error => {
  console.error(`[qa-booking-lane] FAILED: ${error.message}`);
  process.exit(1);
});
