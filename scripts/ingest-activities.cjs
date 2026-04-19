#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CITY_CONFIG = {
  austin: {
    id: "austin",
    label: "Austin, TX",
    coords: { lat: 30.2672, lng: -97.7431 },
  },
  nyc: {
    id: "nyc",
    label: "New York, NY",
    coords: { lat: 40.7128, lng: -74.006 },
  },
  miami: {
    id: "miami",
    label: "Miami, FL",
    coords: { lat: 25.7617, lng: -80.1918 },
  },
};

const QUERY_PACK = [
  "things to do",
  "tourist attractions",
  "museums",
  "art galleries",
  "science museum",
  "historical landmarks",
  "live music venues",
  "comedy clubs",
  "theaters",
  "outdoor activities",
  "hiking trails",
  "city parks",
  "botanical gardens",
  "boat tours",
  "food tours",
  "street markets",
  "family activities",
  "nightlife",
  "hidden gems",
  "weekend activities",
];

const DEFAULTS = {
  mode: "seed",
  cities: Object.keys(CITY_CONFIG),
  radiusMeters: 35000,
  maxPerQuery: 20,
  minActivitiesPerCity: 300,
  requestDelayMs: 150,
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
      if (value === "seed" || value === "refresh") {
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

    if (key === "radius-meters") {
      const value = Number(inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : NaN);
      if (hasSeparateValue) i += 1;
      if (Number.isFinite(value) && value > 0) {
        options.radiusMeters = Math.round(value);
      }
      continue;
    }

    if (key === "max-per-query") {
      const value = Number(inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : NaN);
      if (hasSeparateValue) i += 1;
      if (Number.isFinite(value) && value > 0) {
        options.maxPerQuery = Math.min(20, Math.round(value));
      }
      continue;
    }

    if (key === "min-activities-per-city") {
      const value = Number(inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : NaN);
      if (hasSeparateValue) i += 1;
      if (Number.isFinite(value) && value > 0) {
        options.minActivitiesPerCity = Math.round(value);
      }
      continue;
    }

    if (key === "request-delay-ms") {
      const value = Number(inlineValue != null ? inlineValue : hasSeparateValue ? nextValue : NaN);
      if (hasSeparateValue) i += 1;
      if (Number.isFinite(value) && value >= 0) {
        options.requestDelayMs = Math.round(value);
      }
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
    selected.push(CITY_CONFIG[cityId]);
  }
  if (!selected.length) {
    throw new Error("No cities selected for ingestion.");
  }
  return selected;
}

function chunkArray(values, chunkSize) {
  const chunks = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findAddressPart(components, preferredTypes, textKey = "longText") {
  if (!Array.isArray(components)) return null;
  for (const typeName of preferredTypes) {
    const part = components.find(component => Array.isArray(component.types) && component.types.includes(typeName));
    if (!part) continue;
    const text = part[textKey] || part.longText || part.shortText;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return null;
}

function mapPriceTier(priceLevel) {
  if (!priceLevel) return "unknown";
  const value = String(priceLevel).toUpperCase();
  if (value.includes("FREE")) return "free";
  if (value.includes("INEXPENSIVE") || value === "$") return "budget";
  if (value.includes("MODERATE") || value === "$$") return "mid";
  if (value.includes("EXPENSIVE") || value.includes("VERY_EXPENSIVE") || value.length >= 3) return "premium";
  return "unknown";
}

function normalizePlace(place, city) {
  const canonicalKey = typeof place.id === "string" ? place.id.trim() : "";
  if (!canonicalKey) return null;

  const title =
    (typeof place.displayName?.text === "string" && place.displayName.text.trim()) ||
    (typeof place.name === "string" && place.name.trim()) ||
    null;
  const lat = Number(place.location?.latitude);
  const lng = Number(place.location?.longitude);
  if (!title || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const addressComponents = Array.isArray(place.addressComponents) ? place.addressComponents : [];
  const categorySet = new Set();
  if (typeof place.primaryType === "string" && place.primaryType.trim()) {
    categorySet.add(place.primaryType.trim());
  }
  if (typeof place.primaryTypeDisplayName?.text === "string" && place.primaryTypeDisplayName.text.trim()) {
    categorySet.add(place.primaryTypeDisplayName.text.trim().toLowerCase());
  }
  if (Array.isArray(place.types)) {
    for (const type of place.types.slice(0, 8)) {
      if (typeof type === "string" && type.trim()) {
        categorySet.add(type.trim());
      }
    }
  }

  const priceTier = mapPriceTier(place.priceLevel);
  const ratingAverage = Number.isFinite(Number(place.rating)) ? Number(place.rating) : null;
  const ratingCount = Number.isFinite(Number(place.userRatingCount))
    ? Number(place.userRatingCount)
    : null;

  const normalized = {
    canonical_key: canonicalKey,
    title,
    summary: null,
    categories: Array.from(categorySet),
    tags: [],
    source_priority: "google_places",
    status: "active",
    location_city:
      findAddressPart(
        addressComponents,
        ["locality", "postal_town", "administrative_area_level_2"],
        "longText"
      ) || city.label.split(",")[0],
    location_region: findAddressPart(addressComponents, ["administrative_area_level_1"], "shortText"),
    location_country_code:
      findAddressPart(addressComponents, ["country"], "shortText")?.toUpperCase() || null,
    location_address_line:
      (typeof place.formattedAddress === "string" && place.formattedAddress.trim()) || null,
    location_lat: lat,
    location_lng: lng,
    location_timezone: null,
    pricing_tier: priceTier,
    pricing_from_minor: null,
    pricing_to_minor: null,
    pricing_currency: "USD",
    pricing_is_free: priceTier === "free",
    duration_minutes_min: null,
    duration_minutes_max: null,
    rating_average: ratingAverage,
    rating_count: ratingCount,
    review_provider: "google_places",
    image_url: null,
    booking_supported: false,
    booking_deep_link: null,
    accessibility_tags: [],
    family_friendly: null,
  };

  const providerRef = {
    provider: "google_places",
    provider_ref: canonicalKey,
    raw_data: {
      id: place.id || null,
      displayName: place.displayName || null,
      primaryType: place.primaryType || null,
      primaryTypeDisplayName: place.primaryTypeDisplayName || null,
      types: Array.isArray(place.types) ? place.types : [],
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      priceLevel: place.priceLevel ?? null,
      formattedAddress: place.formattedAddress ?? null,
      addressComponents,
      location: place.location || null,
      photos: Array.isArray(place.photos) ? place.photos.slice(0, 5) : [],
    },
    last_synced_at: new Date().toISOString(),
  };

  return { normalized, providerRef };
}

async function fetchCityData(client, city, options) {
  const rowsByCanonical = new Map();
  const refsByCanonical = new Map();
  let rawPlaceCount = 0;
  let queryFailures = 0;
  let skippedInvalidRows = 0;

  for (const query of QUERY_PACK) {
    const { data, error } = await client.functions.invoke("discover-places", {
      body: {
        action: "search",
        payload: {
          coords: city.coords,
          radius: options.radiusMeters,
          searchQuery: query,
          strictBounds: false,
          maxResultCount: options.maxPerQuery,
        },
      },
    });

    if (error) {
      queryFailures += 1;
      console.warn(`[ingest] ${city.label} query '${query}' failed: ${error.message}`);
      await sleep(options.requestDelayMs);
      continue;
    }

    if (data && Object.prototype.hasOwnProperty.call(data, "error")) {
      queryFailures += 1;
      const errorValue = data.error;
      const errorMessage =
        typeof errorValue === "string"
          ? errorValue
          : typeof errorValue?.message === "string"
            ? errorValue.message
            : JSON.stringify(errorValue);
      const message = typeof data.message === "string" ? ` (${data.message})` : "";
      console.warn(
        `[ingest] ${city.label} query '${query}' provider response error: ${errorMessage}${message}`
      );
      await sleep(options.requestDelayMs);
      continue;
    }

    const places = Array.isArray(data?.places) ? data.places : [];
    rawPlaceCount += places.length;

    for (const place of places) {
      const normalized = normalizePlace(place, city);
      if (!normalized) {
        skippedInvalidRows += 1;
        continue;
      }
      rowsByCanonical.set(normalized.normalized.canonical_key, normalized.normalized);
      refsByCanonical.set(normalized.providerRef.provider_ref, normalized.providerRef);
    }

    await sleep(options.requestDelayMs);
  }

  return {
    city,
    rawPlaceCount,
    queryFailures,
    skippedInvalidRows,
    rows: Array.from(rowsByCanonical.values()),
    refs: Array.from(refsByCanonical.values()),
  };
}

async function upsertActivities(client, rows) {
  for (const chunk of chunkArray(rows, 200)) {
    const { error } = await client.from("activities").upsert(chunk, {
      onConflict: "canonical_key",
    });
    if (error) throw error;
  }
}

async function getActivityIdsByCanonical(client, canonicalKeys) {
  const mapping = new Map();
  for (const keyChunk of chunkArray(canonicalKeys, 200)) {
    const { data, error } = await client
      .from("activities")
      .select("id,canonical_key")
      .in("canonical_key", keyChunk);
    if (error) throw error;
    for (const row of data || []) {
      mapping.set(row.canonical_key, row.id);
    }
  }
  return mapping;
}

async function upsertProviderRefs(client, refs, activityIdByCanonical) {
  const rows = refs
    .map(ref => ({
      activity_id: activityIdByCanonical.get(ref.provider_ref),
      provider: ref.provider,
      provider_ref: ref.provider_ref,
      raw_data: ref.raw_data,
      last_synced_at: ref.last_synced_at,
    }))
    .filter(row => typeof row.activity_id === "string");

  for (const chunk of chunkArray(rows, 200)) {
    const { error } = await client.from("activity_provider_refs").upsert(chunk, {
      onConflict: "provider,provider_ref",
    });
    if (error) throw error;
  }
}

async function hideStaleCityActivities(client, city, seenCanonicalSet, radiusMeters) {
  const latDelta = (radiusMeters * 1.25) / 111000;
  const lngDelta = (radiusMeters * 1.25) / 111000;

  const { data, error } = await client
    .from("activities")
    .select("id,canonical_key,status")
    .eq("source_priority", "google_places")
    .gte("location_lat", city.coords.lat - latDelta)
    .lte("location_lat", city.coords.lat + latDelta)
    .gte("location_lng", city.coords.lng - lngDelta)
    .lte("location_lng", city.coords.lng + lngDelta);

  if (error) throw error;

  const staleIds = (data || [])
    .filter(row => !seenCanonicalSet.has(row.canonical_key) && row.status !== "hidden")
    .map(row => row.id);

  if (!staleIds.length) return 0;

  let hiddenCount = 0;
  for (const idChunk of chunkArray(staleIds, 200)) {
    const { error: updateError, data: updatedRows } = await client
      .from("activities")
      .update({ status: "hidden" })
      .in("id", idChunk)
      .select("id");
    if (updateError) throw updateError;
    hiddenCount += (updatedRows || []).length;
  }
  return hiddenCount;
}

function printHeader(options, selectedCities) {
  console.log("[ingest] Starting activity ingestion.");
  console.log(`[ingest] Mode: ${options.mode}`);
  console.log(`[ingest] Cities: ${selectedCities.map(city => city.id).join(", ")}`);
  console.log(`[ingest] Radius meters: ${options.radiusMeters}`);
  console.log(`[ingest] Max per query: ${options.maxPerQuery}`);
  console.log(`[ingest] Min activities per city: ${options.minActivitiesPerCity}`);
  console.log(`[ingest] Dry run: ${options.dryRun}`);
}

function printUsage() {
  console.log("Usage:");
  console.log(
    "npm run ingest:activities -- --mode seed --cities austin,nyc,miami --radius-meters 35000 --max-per-query 20"
  );
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  const selectedCities = ensureCities(options.cities);
  printHeader(options, selectedCities);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
  const runtimeKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !runtimeKey) {
    throw new Error(
      "Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL and key (SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }
  if (!options.dryRun && !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for non-dry-run writes.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(supabaseUrl, runtimeKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "blame-travis-ingest" } },
  });

  if (!options.dryRun) {
    const { error: sourceError } = await client.from("activity_sources").upsert(
      {
        name: "google_places",
        api_base_url: "https://places.googleapis.com/v1",
        is_active: true,
        metadata: {
          maintained_by: "scripts/ingest-activities.cjs",
          updated_at: new Date().toISOString(),
        },
      },
      { onConflict: "name" }
    );
    if (sourceError) throw sourceError;
  }

  const cityRuns = [];
  for (const city of selectedCities) {
    console.log(`[ingest] Fetching provider rows for ${city.label}...`);
    const result = await fetchCityData(client, city, options);
    cityRuns.push(result);
    console.log(
      `[ingest] ${city.label}: raw=${result.rawPlaceCount} unique=${result.rows.length} invalid=${result.skippedInvalidRows} failedQueries=${result.queryFailures}`
    );
  }

  const qualityFailures = cityRuns
    .filter(run => run.rows.length < options.minActivitiesPerCity)
    .map(
      run =>
        `${run.city.id} has ${run.rows.length} activities; minimum required is ${options.minActivitiesPerCity}`
    );

  if (qualityFailures.length) {
    throw new Error(
      `Quality gate failed.\n${qualityFailures.map(message => `- ${message}`).join("\n")}`
    );
  }

  if (options.dryRun) {
    console.log("[ingest] Dry run complete. No database writes were executed.");
    return;
  }

  for (const run of cityRuns) {
    const canonicalKeys = run.rows.map(row => row.canonical_key);
    await upsertActivities(client, run.rows);
    const activityIdByCanonical = await getActivityIdsByCanonical(client, canonicalKeys);
    await upsertProviderRefs(client, run.refs, activityIdByCanonical);

    let hiddenCount = 0;
    if (options.mode === "refresh") {
      hiddenCount = await hideStaleCityActivities(
        client,
        run.city,
        new Set(canonicalKeys),
        options.radiusMeters
      );
    }

    console.log(
      `[ingest] ${run.city.label}: upserted ${run.rows.length} activities, upserted ${run.refs.length} provider refs, hidden ${hiddenCount} stale rows.`
    );
  }

  console.log("[ingest] Completed successfully.");
}

main().catch(error => {
  console.error(`[ingest] FAILED: ${error.message}`);
  process.exit(1);
});
