# Discovery Fallback Handoff (Temporary)

Last updated: 2026-04-26

## Why this exists
- The app was moved to **edge-first** discovery helpers for security (autocomplete/geocode/reverse-geocode via `discover-places` Edge Function).
- Some environments may not have the updated Edge function deployed yet.
- To keep development unblocked, a **temporary client fallback** is enabled for non-production workflows.

## Current behavior
- Primary path: `src/services/discovery.ts` -> `supabase.functions.invoke('discover-places', action=...)`
  - `autocomplete-cities`
  - `geocode`
  - `reverse-geocode-locality`
- Fallback path (temporary): direct Google REST call from client only when:
  1. `CLIENT_DISCOVERY_FALLBACK_ENABLED` evaluates true (`__DEV__` or env flag)
  2. `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is present

## Env controls
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
  - Used for native Maps SDK config and temporary fallback calls.
  - Must be restricted by platform/app and API scope.
- `EXPO_PUBLIC_ENABLE_CLIENT_DISCOVERY_FALLBACK=true`
  - Optional override to force fallback outside dev while validating non-prod environments.
  - Must remain unset/false for production.

## Production cutover checklist (required before launch)
1. Deploy latest `supabase/functions/discover-places/index.ts`.
2. Ensure Supabase secrets exist:
   - `GOOGLE_MAPS_API_KEY`
   - `FOURSQUARE_API_KEY`
3. Confirm edge actions return valid payloads:
   - `autocomplete-cities`
   - `geocode`
   - `reverse-geocode-locality`
4. Disable fallback for release:
   - remove `EXPO_PUBLIC_ENABLE_CLIENT_DISCOVERY_FALLBACK`
   - verify production build does not rely on client REST fallback.
5. Run release checks:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm test -- --runInBand`
   - `npx expo-doctor`
   - Android preview build smoke test.

## Ownership note
- This file is the handoff anchor for any agent touching discovery/deploy hardening.
- If fallback logic changes, update this document in the same change set.
