# Sprint 1 Pilot Ingestion Runbook

## Objective
Seed `activities` and `activity_provider_refs` for pilot cities (`austin`, `nyc`, `miami`) using Google Places via the `discover-places` edge function, with idempotent upserts and quality gates.

## Scope
- Inserts or updates rows in:
  - `public.activity_sources`
  - `public.activities`
  - `public.activity_provider_refs`
- Optional refresh mode:
  - Marks stale pilot rows as `hidden` in `public.activities` (non-destructive)

## Prerequisites
1. Supabase migrations `001` through `005` already applied.
2. `discover-places` edge function deployed and configured with `GOOGLE_MAPS_API_KEY`.
3. Local environment has:
   - `SUPABASE_SERVICE_ROLE_KEY` (required for writes due RLS)
   - `SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
4. Dependencies installed (`npm install`).

## Command
```bash
npm run ingest:activities -- --mode seed --cities austin,nyc,miami --radius-meters 35000 --max-per-query 20 --min-activities-per-city 300
```

## Safe Dry Run
Use this first to validate provider reach and quality gates without writing data:
```bash
npm run ingest:activities -- --mode seed --cities austin,nyc,miami --radius-meters 35000 --max-per-query 20 --min-activities-per-city 300 --dry-run
```

## Refresh Run
Use refresh mode after first seed to hide stale pilot inventory:
```bash
npm run ingest:activities -- --mode refresh --cities austin,nyc,miami --radius-meters 35000 --max-per-query 20 --min-activities-per-city 300
```

## Expected Behavior
1. Calls `discover-places` with `action=search` for each city/query pair.
2. Normalizes provider rows into canonical `activities`.
3. Upserts `activities` by `canonical_key`.
4. Upserts `activity_provider_refs` by `(provider, provider_ref)`.
5. Enforces quality gate: minimum activities per city before writing.
6. In refresh mode, stale rows in pilot geofences are set to `status='hidden'`.

## Post-Run Validation Queries
```sql
-- 1) Counts by city and active/hidden state
select location_city, status, count(*) as total
from public.activities
where source_priority = 'google_places'
group by location_city, status
order by location_city, status;

-- 2) Ensure provider refs exist for google places rows
select count(*) as orphaned_google_rows
from public.activities a
left join public.activity_provider_refs r
  on r.activity_id = a.id
 and r.provider = 'google_places'
 and r.provider_ref = a.canonical_key
where a.source_priority = 'google_places'
  and r.id is null;

-- 3) Quality spot check for required fields
select count(*) as missing_required_fields
from public.activities
where source_priority = 'google_places'
  and (
    canonical_key is null
    or title is null
    or location_lat is null
    or location_lng is null
  );
```

## Failure Handling
If quality gate fails (`< min-activities-per-city`):
1. Increase radius (`--radius-meters 45000`).
2. Reduce minimum temporarily (`--min-activities-per-city 220`) for constrained providers.
3. Re-run `--dry-run` first.

If edge function calls fail:
1. Verify `GOOGLE_MAPS_API_KEY` in Supabase edge secrets.
2. Verify edge function deployment and logs.
3. Re-run with a slightly larger `--request-delay-ms` to reduce provider pressure.

## Supabase Agent Responsibilities
If using a Supabase AI agent connected through Supabase MCP:
1. It should not rewrite this ingestion script.
2. It should execute SQL-only validation and report row counts/anomalies.
3. It should confirm:
   - `activity_sources` contains `google_places`
   - no orphaned rows across `activities` <-> `activity_provider_refs`
   - refresh mode only hid rows (no destructive deletes)

## Non-Destructive Rollback
If pilot inventory should be removed from user visibility:
```sql
update public.activities
set status = 'hidden'
where source_priority = 'google_places'
  and location_city in ('Austin', 'New York', 'Miami');
```
Legacy tables and new schema objects remain untouched.
