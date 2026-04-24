# Sprint 4 Funnel Query Definitions

These queries target the future remote booking tables after auth-sync is introduced.

## 1) Intent Volume by Day
```sql
select
  date_trunc('day', started_at) as day_bucket,
  count(*) as intents_started
from public.booking_intents
group by 1
order by 1 desc;
```

## 2) Started -> Outcome Conversion
```sql
with intents as (
  select id, started_at
  from public.booking_intents
),
outcomes as (
  select booking_intent_id, status
  from public.booking_outcomes
)
select
  count(*) as intents_started,
  count(outcomes.booking_intent_id) as intents_with_outcome,
  round(
    (count(outcomes.booking_intent_id)::numeric / nullif(count(*), 0)) * 100,
    2
  ) as outcome_capture_rate_pct
from intents
left join outcomes on outcomes.booking_intent_id = intents.id;
```

## 3) Booked Conversion Rate
```sql
with intents as (
  select id
  from public.booking_intents
),
booked as (
  select booking_intent_id
  from public.booking_outcomes
  where status = 'booked'
)
select
  count(*) as intents_started,
  count(booked.booking_intent_id) as booked_count,
  round(
    (count(booked.booking_intent_id)::numeric / nullif(count(*), 0)) * 100,
    2
  ) as booked_conversion_rate_pct
from intents
left join booked on booked.booking_intent_id = intents.id;
```

## 4) Provider-Level Performance
```sql
select
  bi.provider,
  count(*) as intents_started,
  count(bo.booking_intent_id) as outcomes_recorded,
  count(*) filter (where bo.status = 'booked') as booked_count,
  round(
    (count(*) filter (where bo.status = 'booked')::numeric / nullif(count(*), 0)) * 100,
    2
  ) as booked_rate_pct
from public.booking_intents bi
left join public.booking_outcomes bo on bo.booking_intent_id = bi.id
group by 1
order by intents_started desc;
```

## 5) Failure and Abandon Breakdown
```sql
select
  bi.status as intent_status,
  count(*) as intent_count
from public.booking_intents bi
where bi.status in ('failed', 'abandoned')
group by 1
order by 2 desc;
```

## Guest-Mode Note
During Sprint 4, booking records are stored locally with `auth_sync_required=true`.
These SQL queries become authoritative once auth-phase sync writes local records into remote booking tables.
