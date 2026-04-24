# Sprint 3 Acceptance Evidence Checklist

## Acceptance Gate 1: Reorder Persists Across Reload
- [x] Create/select itinerary with at least 3 items in one day.
- [x] Reorder items (button path).
- [x] Pull-to-refresh or reopen Journeys.
- [x] Confirm order remains identical after reload.
- [x] Repeat using long-press pick/drop mode.

## Acceptance Gate 2: Conflict Warnings Accurate
- [x] Add duplicate activity to same day and confirm duplicate warning.
- [x] Add day to 6+ items and confirm capacity warning.
- [x] Arrange far-apart consecutive stops and confirm medium/high distance warnings.
- [x] Remove conflict conditions and confirm warning clears.

## Acceptance Gate 3: Offline Read Works Without Crashes
- [x] Load itinerary while online to prime snapshot.
- [x] Disable network.
- [x] Reopen Journeys and confirm offline banner appears with snapshot timestamp.
- [x] Verify day list and items render without runtime errors.
- [x] Verify mutation controls are disabled in offline mode.
- [x] Restore network and confirm refresh exits read-only mode.

## Regression + Quality Gates
- [x] `npx tsc --noEmit`
- [x] `npm test -- --runInBand`
- [x] `npm run policy:lint`
- [x] `npm run sprint:end:check`
