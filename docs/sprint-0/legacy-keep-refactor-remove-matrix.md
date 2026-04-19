# Sprint 0 Legacy Keep/Refactor/Remove Matrix

**Date:** 2026-04-19  
**Scope:** Current repository cleanup and migration preparation for activity-discovery direction.

## Decision Legend
- `KEEP`: Retain as-is, no functional rewrite required.
- `REFACTOR`: Preserve concept but rewrite to match new domain contracts.
- `REMOVE`: Decommission after replacement is live and validated.
- `ARCHIVE`: Keep for historical reference only, not in active runtime paths.

## Code Matrix
| Path | Decision | Sprint Target | Required Action | Exit Check |
|---|---|---|---|---|
| `src/types/adventure.ts` | REFACTOR | Sprint 1 | Replace with `activity/itinerary/booking` domain types. Keep temporary adapters only. | No new imports from legacy type names in active screens. |
| `src/types/database.ts` | REFACTOR | Sprint 1-2 | Regenerate types after Supabase migration; remove `adventures/adventure_days` as primary app entities. | Generated types include new tables and RLS-safe inserts. |
| `src/services/discovery.ts` | REFACTOR | Sprint 1 | Split into provider adapters + search orchestrator returning `Activity[]`. | Search path has deterministic request/response envelope. |
| `src/services/adventureData.ts` | REMOVE | Sprint 2 | Replace with itinerary repository service. | No runtime import references remain. |
| `src/services/travis.ts` | REFACTOR | Sprint 2 | Scope to narrative framing only, never logistics facts. | Output excludes factual field overrides. |
| `src/services/places.ts` | REFACTOR | Sprint 1 | Align with provider adapter interface and fallback policy. | Adapter contract tests pass. |
| `src/services/weather.ts` | KEEP | Sprint 3 | Keep as contextual enhancement only. | Weather data optional and non-blocking. |
| `src/services/notifications.ts` | REFACTOR | Sprint 5 | Rebind triggers to itinerary/booking reminders. | Notification types mapped to new event IDs. |
| `src/screens/HomeScreen.tsx` | REFACTOR | Sprint 1 | Replace adventure desk with Explore search surface. | Default screen is search-first and map/list capable. |
| `src/screens/AdventureRequestScreen.tsx` | REMOVE | Sprint 1 | Replace with search + filter entry flow. | Route removed from navigator. |
| `src/screens/AdventureAssignmentScreen.tsx` | REMOVE | Sprint 2 | Replace with activity details + save UX. | Route removed and unreachable. |
| `src/screens/AdventureRevealScreen.tsx` | REFACTOR | Sprint 3 | Repurpose into itinerary reveal summary if needed. | Naming and copy aligned to itinerary terminology. |
| `src/screens/JourneysScreen.tsx` | REFACTOR | Sprint 3 | Convert to itinerary list + day planner. | Supports itinerary CRUD states. |
| `src/screens/LocationDetailsScreen.tsx` | REFACTOR | Sprint 2 | Convert to canonical Activity Details screen. | Displays provider-grounded facts + save/book intent CTA. |
| `src/navigation/RootNavigator.tsx` | REFACTOR | Sprint 1 | Remove legacy adventure routes and wire Explore/Details/Itinerary/Booking. | Legacy routes absent in runtime route map. |
| `src/navigation/TabNavigator.tsx` | REFACTOR | Sprint 1 | Replace tab semantics to Explore, Itineraries, Passport, Profile. | Labels/icons updated and deep links stable. |
| `src/components/StopCard.tsx` | REFACTOR | Sprint 2 | Convert to reusable `ActivityCard` contract. | Card props use canonical `Activity` shape. |
| `src/components/TravisNotice.tsx` | KEEP | Sprint 1+ | Keep as in-app notice pattern, update copy style only. | No use of `Alert.alert` in product flows. |
| `supabase/functions/discover-places/index.ts` | REFACTOR | Sprint 1 | Make this adapter gateway for POI + search normalization. | Actions mapped to adapter spec and error envelope. |
| `supabase/functions/place-details/index.ts` | REFACTOR | Sprint 2 | Normalize to `Activity` detail payload and caching policy. | Detail payload is contract-compliant. |
| `supabase/functions/travis-narrative/index.ts` | REFACTOR | Sprint 2 | Narrative-only endpoint with schema-validated inputs. | No logistics field mutation in output contract. |
| `supabase/functions/notification-dispatch/index.ts` | KEEP | Sprint 5 | Keep infrastructure, retarget event triggers. | Delivery events use new event names. |
| `supabase/update_v2.sql` | ARCHIVE | Sprint 0 | Keep for audit history only. | Referenced in migration manifest. |
| `supabase/update_v3.sql` | ARCHIVE | Sprint 0 | Keep for audit history only. | Referenced in migration manifest. |
| `supabase/update_v4.sql` | ARCHIVE | Sprint 0 | Keep for audit history only. | Referenced in migration manifest. |
| `assets/screen designs/*mission*` | ARCHIVE | Sprint 1 | Move under `assets/archive/legacy-adventure/`. | Not used in active app navigation mocks. |

## Database Object Matrix
| Legacy Table | Decision | New Table(s) | Notes |
|---|---|---|---|
| `adventures` | REFACTOR | `itineraries`, `itinerary_items`, `booking_intents` | Split broad table into normalized entities. |
| `adventure_days` | REFACTOR | `itinerary_items` | Convert day/stop JSON into rows. |
| `profiles` | REFACTOR | `user_preferences` + `profiles` | Keep identity in `profiles`; move recommendation/filter prefs. |
| `notification_devices` | KEEP | `notification_devices` | Keep schema with minor event-type updates. |
| `notification_deliveries` | REFACTOR | `notification_deliveries` | Keep table, update type/status enums to new event taxonomy. |
| `global_hubs` | REMOVE | none (optional future `destinations`) | No longer required for search-first MVP. |

## Cleanup Execution Order
1. Land contracts and migration plan docs (Sprint 0).
2. Add feature flags and compatibility adapters.
3. Build new Explore path behind flags.
4. Migrate data model and adapters.
5. Cut over routes and remove legacy screens/services.
6. Remove dead code only after telemetry and QA pass.

## Explicit Non-Goals in Sprint 0
- No destructive table drops.
- No route removals yet.
- No production data mutation.
