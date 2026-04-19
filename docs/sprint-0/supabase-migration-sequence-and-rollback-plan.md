# Supabase Migration Sequence and Rollback Plan (travel-v1)

**Date:** 2026-04-19  
**Owner:** Supabase SQL agent (execution) + app team (integration)  
**Type:** Non-destructive phased migration

## Target Tables
- `user_preferences`
- `activities`
- `activity_sources`
- `activity_provider_refs`
- `search_sessions`
- `activity_events`
- `saved_activities`
- `itineraries`
- `itinerary_items`
- `booking_intents`
- `booking_outcomes`

## Existing Legacy Inputs
- `profiles`
- `adventures`
- `adventure_days`
- `notification_devices`
- `notification_deliveries`

## Phase-by-Phase Migration
### Phase A: Foundation
1. Create new enums for status fields.
2. Create all target tables with `created_at`, `updated_at`.
3. Create required indexes and unique constraints.
4. Enable RLS on all user-owned tables.
5. Add `touch_updated_at` trigger coverage.

### Phase B: Backfill-Compatible Links
1. Create mapping table `legacy_activity_map` (temporary) to map stop records to canonical activity IDs.
2. Create `legacy_itinerary_map` (temporary) mapping `adventures.id -> itineraries.id`.

### Phase C: Data Backfill
1. Backfill `user_preferences` from `profiles`.
2. Backfill `itineraries` from `adventures`.
3. Parse `adventure_days.itinerary_json` into normalized `activities` + `itinerary_items`.
4. Seed `saved_activities` from existing favorite-like states if present (else leave empty).
5. Seed `booking_intents` only where legacy event data exists.

### Phase D: Validation
1. Row-count validation queries.
2. Referential integrity checks.
3. Null-rate checks on required fields.
4. Duplicate detection on unique indexes.

### Phase E: Compatibility Window
1. Keep legacy tables read-only for one full sprint.
2. App writes only to new tables after feature-flag cutover.
3. Maintain compatibility views if legacy reads are still required.

### Phase F: Legacy Decommission (Deferred)
1. Archive legacy data snapshot.
2. Drop legacy write paths.
3. Drop legacy tables only after explicit sign-off.

## Required Constraints and Indexes
| Table | Must-Have Constraints/Indexes |
|---|---|
| `activities` | unique `canonical_key`, index `(source_priority, updated_at)` |
| `activity_provider_refs` | unique `(provider, provider_ref)`, FK `activity_id` |
| `search_sessions` | index `(user_id, created_at desc)` |
| `activity_events` | index `(user_id, event_name, occurred_at desc)`, index `(activity_id)` |
| `saved_activities` | unique `(user_id, activity_id)`, index `(user_id, saved_at desc)` |
| `itineraries` | index `(user_id, updated_at desc)`, status check constraint |
| `itinerary_items` | unique `(itinerary_id, day_index, position_index)`, index `(activity_id)` |
| `booking_intents` | index `(user_id, started_at desc)`, index `(activity_id, provider)` |
| `booking_outcomes` | unique `(booking_intent_id)`, index `(user_id, created_at desc)` |

## RLS Policy Minimums
1. User can `select/insert/update/delete` only own rows (`user_id = auth.uid()`).
2. Service role can bypass for controlled edge functions.
3. No anonymous write to user-owned tables.
4. Any public-read exceptions must be explicit and documented.

## Feature Flags for Safe Cutover
- `explore_search_v1_enabled`
- `activity_details_v1_enabled`
- `saved_activities_v1_enabled`
- `itinerary_builder_v1_enabled`
- `booking_tracking_v1_enabled`
- `legacy_adventure_flow_enabled` (default `true` until cutover)

## Rollback Plan
### Rollback Trigger Conditions
1. Data validation mismatch > 1%.
2. RLS policy blocks valid owner writes.
3. Critical path API error rate > 5% post-cutover.

### Rollback Steps
1. Flip runtime flags to restore `legacy_adventure_flow_enabled = true` and disable new v1 flags.
2. Stop writes to new tables at app layer.
3. Preserve failed migration artifacts for audit.
4. Restore from pre-migration backup only if data corruption is confirmed.
5. Open incident record with root-cause category.

## Verification Queries (Must Run)
1. Backfill counts by user:
```sql
select p.id as user_id,
       count(distinct a.id) as legacy_adventures,
       count(distinct i.id) as new_itineraries
from profiles p
left join adventures a on a.user_id = p.id
left join itineraries i on i.user_id = p.id
group by p.id;
```
2. Duplicate saved guard:
```sql
select user_id, activity_id, count(*)
from saved_activities
group by user_id, activity_id
having count(*) > 1;
```
3. Orphan itinerary items:
```sql
select ii.id
from itinerary_items ii
left join itineraries i on i.id = ii.itinerary_id
where i.id is null;
```

## Deliverables Expected from Supabase SQL Agent
1. Ordered SQL migration files with transaction boundaries.
2. Backfill SQL scripts with idempotency notes.
3. RLS policy SQL + policy explanation table.
4. Validation query pack and expected results format.
5. Rollback script pack (non-destructive).
