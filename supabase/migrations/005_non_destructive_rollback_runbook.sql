-- TRULY NON-DESTRUCTIVE ROLLBACK OPERATIONAL PROTOCOL 
-- (No Drops / No Policy Mutating / No Truncation / No RLS Disabling)

-- Rollback Procedure:
-- 1. Halt API interactions for V1 write requests via app-tier feature flag rollback.
--      Toggle flags in your config provider (e.g. split.io or expo-config):
--      - SET legacy_adventure_flow_enabled = true
--      - SET explore_search_v1_enabled = false
--      - SET itinerary_builder_v1_enabled = false

-- 2. Client Fallback and Write Protection:
--    The app inherently defines write bounds via its deployed queries. By toggling the flags, the App
--    immediately routes reads and writes safely back to the unmodified `public.adventures` models. 
--    `activities` and `itineraries` will naturally enter operational stasis. Database operations on legacy tables 
--    will continue smoothly as they were untampered with.

-- 3. Runbook Open for Debugging: 
--    Preserve the V1 table states exactly as they are to investigate any JSON schema conflicts, parity mismatches,
--    or unexpected write blocks that caused the rollout to fail. Perform root cause analysis with full context intact.
