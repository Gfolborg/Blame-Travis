#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DEFAULTS = {
  mode: "seed",
  dryRun: false,
  confirmPurge: false,
};

const QA_PARTNER_SLUG = "qa_mock_partner_v1";
const QA_PLACEMENTS = [
  { surface: "details_primary_cta", placement_key: "qa_details_primary_cta", disclosure_required: true, active: true },
  { surface: "journeys_stop_cta", placement_key: "qa_journeys_stop_cta", disclosure_required: true, active: true },
  { surface: "explore_card", placement_key: "qa_explore_card_badge", disclosure_required: true, active: true },
];

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
      if (["seed", "cleanup", "purge", "verify"].includes(value)) {
        options.mode = value;
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

async function createClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "blame-travis-qa-affiliate-foundation" } },
  });
}

async function upsertPartner(client) {
  const row = {
    slug: QA_PARTNER_SLUG,
    name: "QA Mock Partner",
    status: "active",
    disclosure_label: "Partner offer",
    default_commission_model: "cpa",
    metadata: {
      qa: true,
      source: "scripts/qa-affiliate-foundation.cjs",
      seeded_at: new Date().toISOString(),
    },
  };

  const { error } = await client.from("affiliate_partners").upsert(row, { onConflict: "slug" });
  if (error) throw error;

  const { data, error: fetchError } = await client
    .from("affiliate_partners")
    .select("id,slug")
    .eq("slug", QA_PARTNER_SLUG)
    .single();
  if (fetchError) throw fetchError;
  return data.id;
}

async function upsertOffers(client, partnerId) {
  const now = Date.now();
  const rows = [
    {
      partner_id: partnerId,
      provider_ref: "qa_offer_details_v1",
      title: "QA Offer - Details Surface",
      status: "active",
      commission_model: "cpa",
      commission_value: 12.5,
      currency_code: "USD",
      destination_scope: ["Austin", "New York"],
      category_scope: ["museum", "outdoor"],
      tracking_template: "https://partner.example.com/book?campaign=qa_details_v1",
      valid_from: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      valid_to: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { qa: true, surface: "details/journeys" },
    },
  ];

  const { error } = await client.from("affiliate_offers").upsert(rows, {
    onConflict: "partner_id,provider_ref",
  });
  if (error) throw error;

  const { data, error: fetchError } = await client
    .from("affiliate_offers")
    .select("id,provider_ref,status")
    .eq("partner_id", partnerId)
    .in(
      "provider_ref",
      rows.map(row => row.provider_ref),
    );
  if (fetchError) throw fetchError;
  return data || [];
}

async function upsertPlacements(client) {
  const { error } = await client.from("affiliate_placements").upsert(QA_PLACEMENTS, {
    onConflict: "placement_key",
  });
  if (error) throw error;
}

async function cleanup(client) {
  const { data: partnerRows, error: partnerError } = await client
    .from("affiliate_partners")
    .select("id")
    .eq("slug", QA_PARTNER_SLUG);
  if (partnerError) throw partnerError;
  const partnerIds = (partnerRows || []).map(row => row.id);

  if (partnerIds.length) {
    const { error: offerError } = await client
      .from("affiliate_offers")
      .update({ status: "paused" })
      .in("partner_id", partnerIds);
    if (offerError) throw offerError;

    const { error: partnerStatusError } = await client
      .from("affiliate_partners")
      .update({ status: "paused" })
      .in("id", partnerIds);
    if (partnerStatusError) throw partnerStatusError;
  }

  const { error: placementError } = await client
    .from("affiliate_placements")
    .update({ active: false })
    .in(
      "placement_key",
      QA_PLACEMENTS.map(row => row.placement_key),
    );
  if (placementError) throw placementError;

  return { partnerCount: partnerIds.length };
}

async function purge(client) {
  const { data: partners, error: partnerError } = await client
    .from("affiliate_partners")
    .select("id")
    .eq("slug", QA_PARTNER_SLUG);
  if (partnerError) throw partnerError;
  const partnerIds = (partners || []).map(row => row.id);

  if (partnerIds.length) {
    const { data: offers, error: offersError } = await client
      .from("affiliate_offers")
      .select("id")
      .in("partner_id", partnerIds);
    if (offersError) throw offersError;
    const offerIds = (offers || []).map(row => row.id);

    if (offerIds.length) {
      const { error: payoutDeleteError } = await client
        .from("affiliate_payout_events")
        .delete()
        .in("offer_id", offerIds);
      if (payoutDeleteError) throw payoutDeleteError;
    }

    const { error: attributionDeleteError } = await client
      .from("affiliate_attributions")
      .delete()
      .in("partner_id", partnerIds);
    if (attributionDeleteError) throw attributionDeleteError;

    const { error: offersDeleteError } = await client
      .from("affiliate_offers")
      .delete()
      .in("partner_id", partnerIds);
    if (offersDeleteError) throw offersDeleteError;

    const { error: partnerDeleteError } = await client
      .from("affiliate_partners")
      .delete()
      .in("id", partnerIds);
    if (partnerDeleteError) throw partnerDeleteError;
  }

  const { error: placementDeleteError } = await client
    .from("affiliate_placements")
    .delete()
    .in(
      "placement_key",
      QA_PLACEMENTS.map(row => row.placement_key),
    );
  if (placementDeleteError) throw placementDeleteError;

  return { purgedPartners: partnerIds.length };
}

async function verify(client) {
  const { data: partners, error: partnerError } = await client
    .from("affiliate_partners")
    .select("id,name,status")
    .eq("slug", QA_PARTNER_SLUG);
  if (partnerError) throw partnerError;
  const partnerIds = (partners || []).map(row => row.id);
  if (!partnerIds.length) {
    console.log("[qa-affiliate-foundation] No QA partner rows found.");
    return;
  }

  const { data: attributions, error: attributionError } = await client
    .from("affiliate_attributions")
    .select("partner_id,offer_id,placement_key,copy_variant,event_name,click_ts")
    .in("partner_id", partnerIds)
    .order("click_ts", { ascending: false })
    .limit(200);
  if (attributionError) throw attributionError;

  const grouped = new Map();
  for (const row of attributions || []) {
    const key = `${row.partner_id}|${row.offer_id}|${row.placement_key}|${row.copy_variant || "null"}|${row.event_name}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }

  console.log("[qa-affiliate-foundation] Verification summary:");
  console.log(`- attribution_rows: ${(attributions || []).length}`);
  for (const [key, count] of grouped.entries()) {
    console.log(`- ${key} => ${count}`);
  }
}

function printUsage() {
  console.log("Usage:");
  console.log("node scripts/qa-affiliate-foundation.cjs --mode seed");
  console.log("node scripts/qa-affiliate-foundation.cjs --mode cleanup");
  console.log("node scripts/qa-affiliate-foundation.cjs --mode purge --confirm-purge yes");
  console.log("node scripts/qa-affiliate-foundation.cjs --mode verify");
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  console.log(`[qa-affiliate-foundation] mode=${options.mode} dry_run=${options.dryRun}`);

  if (options.dryRun) {
    console.log("[qa-affiliate-foundation] Dry run only.");
    console.log(`- partner slug: ${QA_PARTNER_SLUG}`);
    console.log(`- placements: ${QA_PLACEMENTS.map(p => p.placement_key).join(", ")}`);
    return;
  }

  const client = await createClient();

  if (options.mode === "seed") {
    const partnerId = await upsertPartner(client);
    const offers = await upsertOffers(client, partnerId);
    await upsertPlacements(client);
    console.log(`[qa-affiliate-foundation] Seed complete. partner_id=${partnerId} offers=${offers.length}`);
    return;
  }

  if (options.mode === "cleanup") {
    const result = await cleanup(client);
    console.log(`[qa-affiliate-foundation] Cleanup complete. partners=${result.partnerCount}`);
    return;
  }

  if (options.mode === "verify") {
    await verify(client);
    return;
  }

  if (!options.confirmPurge) {
    throw new Error("Purge mode is destructive. Re-run with --confirm-purge yes.");
  }
  const result = await purge(client);
  console.log(`[qa-affiliate-foundation] Purge complete. partners=${result.purgedPartners}`);
}

main().catch(error => {
  console.error(`[qa-affiliate-foundation] FAILED: ${error.message}`);
  process.exit(1);
});

