# Sprint 4 Affiliate QA Runbook (Dark Launch)

## Purpose

Deterministic QA data setup for affiliate foundation testing while all affiliate UI remains dark in normal app usage.

## Preconditions

- Service role credentials available in local `.env`:
  - `SUPABASE_URL` (or `EXPO_PUBLIC_SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY`
- Affiliate feature flags remain `false` by default in `src/config/featureFlags.ts`.

## Commands

1. Dry run (safe preview)
```bash
node scripts/qa-affiliate-foundation.cjs --mode seed --dry-run
```

2. Seed QA partner/offer/placements
```bash
npm run qa:seed:affiliate-foundation
```

3. Verify attribution queryability summary
```bash
npm run qa:verify:affiliate-foundation
```

4. Cleanup (non-destructive disable)
```bash
npm run qa:cleanup:affiliate-foundation
```

5. Purge (destructive, explicit confirm required)
```bash
npm run qa:purge:affiliate-foundation
```

Equivalent manual purge:
```bash
node scripts/qa-affiliate-foundation.cjs --mode purge --confirm-purge yes
```

## Expected Seeded Data

- Partner slug: `qa_mock_partner_v1`
- Offer provider ref: `qa_offer_details_v1`
- Placement keys:
  - `qa_details_primary_cta`
  - `qa_journeys_stop_cta`
  - `qa_explore_card_badge`

## Verification Queries

Run these in Supabase SQL editor after event generation:

```sql
-- By partner + offer + placement
select
  aa.partner_id,
  aa.offer_id,
  aa.placement_key,
  count(*) as event_count
from public.affiliate_attributions aa
group by aa.partner_id, aa.offer_id, aa.placement_key
order by event_count desc;
```

```sql
-- By partner + offer + placement + copy variant
select
  aa.partner_id,
  aa.offer_id,
  aa.placement_key,
  coalesce(aa.copy_variant, 'null') as copy_variant,
  count(*) as event_count
from public.affiliate_attributions aa
group by aa.partner_id, aa.offer_id, aa.placement_key, coalesce(aa.copy_variant, 'null')
order by event_count desc;
```

```sql
-- Dedupe signal visibility
select
  aa.partner_id,
  aa.offer_id,
  aa.source_surface,
  aa.deduped,
  count(*) as row_count
from public.affiliate_attributions aa
group by aa.partner_id, aa.offer_id, aa.source_surface, aa.deduped
order by row_count desc;
```

