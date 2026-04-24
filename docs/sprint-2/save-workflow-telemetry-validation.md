# Sprint 2 Telemetry Validation Notes

## Scope
This validation covers Activity Details and Save flow telemetry for Sprint 2.

## Event Contract Coverage
- `activity_details_viewed`
  - Emitted from details screen load after details + save state resolution.
  - Includes `activityId` as canonical key fallback and context metadata from details flow.
- `activity_saved`
  - Emitted from Explore and Details save actions.
  - Includes `activityId`, `searchSessionId` when available, and `context` metadata.
- `activity_unsaved`
  - Emitted from Explore and Details unsave actions.
  - Includes `activityId`, `searchSessionId` when available, and `context` metadata.

## Implementation Evidence
- Save/unsave event wiring validated in:
  - [ExploreScreen.tsx](/C:/Users/gyasi/.gemini/antigravity/scratch/blame_travis/src/screens/ExploreScreen.tsx)
  - [LocationDetailsScreen.tsx](/C:/Users/gyasi/.gemini/antigravity/scratch/blame_travis/src/screens/LocationDetailsScreen.tsx)
- Event dispatch service and safe UUID handling validated in:
  - [explore.ts](/C:/Users/gyasi/.gemini/antigravity/scratch/blame_travis/src/services/explore.ts)
- Save persistence path and identity resolution validated in:
  - [activities.ts](/C:/Users/gyasi/.gemini/antigravity/scratch/blame_travis/src/services/activities.ts)

## Automated Validation Evidence
- Type check passed: `npx tsc --noEmit`
- Unit tests passed: `npm test -- --runInBand`
- Policy checks passed: `npm run policy:lint`
- Sprint close gate passed: `npm run sprint:end:check`

## Manual QA Checklist (Sprint 2)
- Open details from Explore list and verify details load without dead-end state.
- Save from Explore card; verify state reflects immediately and survives navigation.
- Unsave from Explore card; verify state reflects immediately and survives navigation.
- Save from Details screen; verify heart state sync when returning to Explore.
- Trigger save failure path (network/auth error) and verify rollback + clear user messaging.
- Screen reader check:
  - Save announces: `Saved`
  - Unsave announces: `Removed from saved`
  - Failure announces: `Save failed`

## Deployment Note
- Live invoke smoke-test confirms remote function contract is active:
  - Function is reachable.
  - Current response shape keys: `explanation`.
  - `get-activity-explanation` contract is verified in deployed environment.
