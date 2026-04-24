# Sprint 4 Follow-up: Auth-Phase Booking Sync

## Why This Exists
Sprint 4 persists booking funnel records in local guest storage by design.  
This document is the required handoff for the auth-introduction phase.

## Deferred Work (Must Be Completed When Auth Is Introduced)
1. Sync local booking intents/outcomes into Supabase `booking_intents` and `booking_outcomes`.
2. Map local commission attribution fields into final DB model.
3. Preserve idempotency and dedupe by deterministic intent linkage.
4. Remove or migrate `auth_sync_required=true` records after successful remote sync.
5. Replace guest-local booking reads with remote-first reads (with fallback while migration window is open).

## Required Validation During Auth Migration
1. No booking intent/outcome records lost during sync.
2. Funnel event counts remain within expected parity vs guest-local baseline.
3. Booking status chips render same effective state before and after sync.
