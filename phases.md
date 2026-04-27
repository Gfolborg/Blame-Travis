# Blame Travis Sprint Roadmap

**Last Updated:** 2026-04-27
**Execution Model:** Vertical slice delivery by user outcome
**Core Product:** Things-to-do discovery -> itinerary planning -> booking conversion -> retention

## Global Sprint Rules

### Status Policy
- Only one sprint can be `In Progress` unless user explicitly approves parallel execution.
- Future sprints stay `Not Started` until prior sprint acceptance gates pass.
- Before changing sprint status to `In Progress`, run `npm run sprint:start:check`.
- Before changing sprint status to `Completed`, run `npm run sprint:end:check`.

### Sprint Completion Policy
A sprint is complete only when all items below are true:
- Scope checklist complete
- Deliverables produced
- Acceptance gates passed
- Regression checks passed
- Documentation updated
- Open risks recorded with owner and next action
- `npm run sprint:end:check` passes with no blocking policy errors

### Global Quality Baselines
- No LLM-generated logistics facts are treated as source truth.
- All user-owned Supabase tables use RLS.
- All touched screens include loading, empty, error, offline, and denied-permission handling.
- Android-first performance remains a release-critical requirement.

---

## UI/UX Development Track (Applies to Every Sprint)
**Status:** Active Standard
**Objective:** Keep UX quality synchronized with implementation so no late-cycle redesign is required.

### Required Workflow
1. Define UX contract for slice (entry, action, success, failure, recovery).
2. Produce low-fi flow and state inventory.
3. Produce high-fi interaction states for all mandatory states.
4. Implement component-first UI with shared primitives.
5. Validate with realistic data fixtures.
6. Run usability walkthrough against task scenarios.
7. Validate accessibility and one-handed reach.
8. Run visual consistency pass against design tokens.

### Required UX Artifacts Per Sprint
- Flow map
- State matrix
- Updated component checklist
- UX test notes (pass/fail)

### UX Acceptance Gates Per Sprint
- User can identify next action in under 3 seconds on key screens.
- No dead-end state exists without a recovery action.
- Primary CTA is visible or obviously reachable.
- Travis copy is motivational and non-punitive.

---

## Sprint 0: Product Reset, Contracts, and Migration Plan
**Status:** Completed
**Objective:** Eliminate legacy ambiguity and establish fixed contracts for implementation.
**Primary Outcome:** Engineering and DB work can proceed without reinterpretation.

### Entry Criteria
- Product direction approved in README and AGENTS/gemini docs.

### Scope Checklist
- [x] Complete legacy keep/refactor/remove matrix.
- [x] Define canonical contracts:
  - [x] Activity
  - [x] SearchFilters
  - [x] SavedActivity
  - [x] Itinerary
  - [x] BookingIntent
  - [x] BookingOutcome
- [x] Define analytics event names and payload schema.
- [x] Define provider adapter interfaces and timeout/retry policy.
- [x] Produce migration sequence with rollback plan.
- [x] Add feature flags for any behavior-breaking transitions.

### Required Deliverables
- Architecture decision record for contract schema (`docs/sprint-0/adr-001-canonical-domain-contracts.md`)
- Migration sequencing document (`docs/sprint-0/supabase-migration-sequence-and-rollback-plan.md`)
- Legacy cleanup checklist (`docs/sprint-0/legacy-keep-refactor-remove-matrix.md`)

### Supabase Agent Prompt
```text
Use the full handoff package in docs/sprint-0/supabase-agent-handoff.md.
Core model:
user_preferences, activities, activity_sources, activity_provider_refs, search_sessions, activity_events, saved_activities, itineraries, itinerary_items, booking_intents, booking_outcomes.
Must include: migration order, backfill plan, rollback notes, and policy impact notes.
```

### Acceptance Gates
- [x] Contract definitions approved.
- [x] Migration sequence approved.
- [x] Legacy cleanup plan approved.

### Exit Criteria
- Sprint 1 can begin without unresolved naming/model disputes.

### Progress Log
- 2026-04-19: Sprint initialized.
- 2026-04-19: `npm run sprint:start:check` passed (policy lint PASS; warning: no sprint in progress before activation).
- 2026-04-19: Added Sprint 0 artifact pack in `docs/sprint-0/`:
  - contracts ADR
  - legacy keep/refactor/remove matrix
  - provider adapter and reliability spec
  - analytics event schema
  - migration sequence and rollback plan
  - Supabase agent handoff package
- 2026-04-19: Added feature-flag scaffold in `src/config/featureFlags.ts`.
- 2026-04-19: `npm run sprint:end:check` passed (policy lint PASS).
- 2026-04-19: Supabase travel-v1 migration files executed successfully on project `tcrkvrworzylhxkkaydv` with all validation checks passing (`0` anomalies).
- 2026-04-19: Sprint 0 closed; Sprint 1 authorized to begin.

---

## Sprint 1: Vertical Slice A - Explore Search (List + Map)
**Status:** Completed
**Objective:** Deliver reliable and fast activity discovery.
**Primary Outcome:** Users can search, filter, and browse activities in list and map views.

### Entry Criteria
- Sprint 0 contracts complete.

### Scope Checklist
- [x] Implement destination and near-me query input.
- [x] Implement category chips with deterministic state handling.
- [x] Implement filter sheet for:
  - [x] price
  - [x] duration
  - [x] category
  - [x] date/availability
  - [x] rating
  - [x] group type
  - [x] accessibility
- [x] Apply max-selection rules for filter categories where configured.
- [x] Render canonical activity cards in list view.
- [x] Implement map view with synchronized selected activity state.
- [x] Implement no-result recovery options.
- [x] Add telemetry for query/filter/map-toggle/result-click.

### Required Deliverables
- Explore screen implementation
- Filter state manager
- Map/list synchronization logic
- Telemetry events implemented and validated

### Acceptance Gates
- [x] Query + filter updates return stable results.
- [x] Map/list selected item stays synchronized.
- [x] No-result state provides at least one recovery action.
- [x] Median local UI interaction response < 100ms.

### Exit Criteria
- User can discover candidate activities without dead ends.

### Progress Log
- 2026-04-19: Sprint initialized.
- 2026-04-19: Sprint activated after Sprint 0 completion.
- 2026-04-19: Dev flags updated to enable Explore v1 while retaining legacy fallback (`explore_search_v1_enabled=true`, `legacy_adventure_flow_enabled=true`).
- 2026-04-19: Regenerated `src/types/database.ts` from Supabase project `tcrkvrworzylhxkkaydv` (`public` schema) with travel-v1 tables and enums.
- 2026-04-19: Implemented feature-flagged Explore screen at Home route with destination/near-me search, full filter set, list/map toggle parity, no-result recovery, and direct activity telemetry wiring.
- 2026-04-19: Cleared TypeScript compile blockers (`npx tsc --noEmit` passing) and added Sprint 1 Explore performance polish (list virtualization + memoized map markers).
- 2026-04-19: Added pilot ingestion tooling and runbook (`scripts/ingest-activities.cjs`, `docs/sprint-1/pilot-ingestion-runbook.md`) for Austin/NYC/Miami Google Places seeding with quality gates and idempotent upserts.
- 2026-04-19: Executed pilot seed ingestion successfully: Austin `304`, NYC `365`, Miami `308` activities upserted; provider refs matched 1:1; no stale rows hidden.
- 2026-04-19: Post-seed validation passed: city/status counts loaded (Austin `304`, NYC `365`, Miami `308` active), orphan provider refs `0`, activities missing refs `0`, required-field gaps `0`; explore smoke checks returned non-empty destination and near-me result sets.
- 2026-04-19: Completed Sprint 1 acceptance gates: added unit tests for `exploreService`, fixed Babel/Jest environment issues, and verified synchronized map/list states. Temporarily disabled price-tier filter in UI due to 'unknown' seeded data. Sprint 1 CLOSED.

---

## Sprint 2: Vertical Slice B - Activity Details and Save
**Status:** Completed
**Completed:** 2026-04-20
**Objective:** Turn discovery into intent by enabling detail inspection and saving.
**Primary Outcome:** Users can save and manage activity choices confidently.

### Entry Criteria
- Sprint 1 acceptance gates passed.

### Scope Checklist
- [x] Build details view with provider-attributed facts.
- [x] Add "Why Travis picked this" explanation with grounded inputs.
- [x] Implement save/unsave with optimistic update and failure rollback.
- [x] Keep save state consistent across list, map, and details.
- [x] Cache recent details for faster return navigation.
- [x] Emit detail/save telemetry events.

### Supabase Agent Prompt
```text
Create or verify SQL for saved activity workflow:
- unique constraint on (user_id, activity_id)
- indexed reads by (user_id, saved_at desc)
- updated_at handling
- strict owner RLS
```

### Required Deliverables
- Details screen
- Save service + state sync logic
- Save workflow telemetry validation notes

### Acceptance Gates
- [x] Save state consistency verified across all surfaces.
- [x] Save failure fallback preserves user clarity.
- [x] Screen reader announces save-state changes.

### Exit Criteria
- Saved list behavior is deterministic and persistent.

### Key Decisions
- Save-state identity matching is keyed by UUID, canonical key, and provider-alias forms to prevent cross-surface drift.
- Details fetch now uses a short-lived in-memory cache (10 minutes) to improve return-navigation responsiveness.
- Save-state accessibility announcements are mandatory and emitted on success/failure paths in both Explore and Details flows.

### Files Created/Modified
- `src/services/activities.ts`
- `src/services/activities.test.ts`
- `src/services/explore.test.ts`
- `src/screens/ExploreScreen.tsx`
- `src/screens/LocationDetailsScreen.tsx`
- `docs/sprint-2/save-workflow-telemetry-validation.md`
- `phases.md`

### Progress Log
- 2026-04-19: Sprint initialized.
- 2026-04-19: Implemented `activitiesService` with DB-first detail resolution, Travis AI explanations via Edge Functions, and persistent save/unsave logic with RLS compliance.
- 2026-04-19: Refactored `LocationDetailsScreen` to show pricing, duration, and grounded Travis briefings; added optimistic Heart-toggle for saving.
- 2026-04-19: Updated `ExploreScreen` activity cards with synchronized save status and accessibility labels.
- 2026-04-19: Added unit tests for `activitiesService` covering CRUD operations and edge cases. Sprint 2 CLOSE-READY.
- 2026-04-20: Completed save-state hardening with cross-surface identity-key matching (UUID/canonical/provider IDs) and added details cache TTL path in `activitiesService`.
- 2026-04-20: Added explicit accessibility announcements for save/unsave/failure states on Explore and Details surfaces.
- 2026-04-20: Updated/expanded unit coverage in `src/services/activities.test.ts` and `src/services/explore.test.ts`; all tests passing.
- 2026-04-20: Closeout gates verified: `npm run sprint:end:check` PASS, `npm run policy:lint` PASS, `npx tsc --noEmit` PASS, `npm test -- --runInBand` PASS.
- 2026-04-20: Added Sprint 2 telemetry validation notes at `docs/sprint-2/save-workflow-telemetry-validation.md`.
- 2026-04-20: Attempted `supabase functions deploy travis-narrative --project-ref tcrkvrworzylhxkkaydv`; blocked by missing CLI auth token in shell. No code rollback required; app fallback narrative path remains in place.
- 2026-04-20: Ran live invoke smoke-test on `travis-narrative`; endpoint reachable but returned legacy narrative payload shape (`title`, `main_goal`, `bonus_goal`, `why_travis_picked_this`, `stop_insights`). Remote deployment still required to confirm `get-activity-explanation` contract.
- 2026-04-20: Post-deploy live invoke verification passed; `travis-narrative` now returns `{ explanation }` for `get-activity-explanation` action in project `tcrkvrworzylhxkkaydv`.

---

## Sprint 3: Vertical Slice C - Itinerary Builder
**Status:** Completed
**Completed:** 2026-04-20
**Objective:** Convert saved intent into a practical, editable itinerary.
**Primary Outcome:** Users can organize activities into a usable schedule.

### Entry Criteria
- Sprint 2 acceptance gates passed.

### Scope Checklist
- [x] Build itinerary page grouped by day.
- [x] Implement add/remove/reorder item behavior.
- [x] Add conflict checks for overlapping time windows.
- [x] Add rough travel-time sanity warnings.
- [x] Add itinerary summary metrics.
- [x] Add offline read support for active itinerary.
- [x] Add empty-state CTA routing back to Explore.

### Supabase Agent Prompt
```text
Create or verify SQL for itineraries and itinerary_items:
- ordering constraints per itinerary/day
- status enum validation
- indexed reads by (user_id, status, updated_at)
- owner-only RLS
```

### Required Deliverables
- Itinerary builder UI
- Itinerary persistence layer
- Conflict detection utility

### Acceptance Gates
- [x] Reorder behavior persists across reload.
- [x] Conflict warnings are accurate in test scenarios.
- [x] Offline itinerary read works without crashes.

### Exit Criteria
- Users can form and edit an itinerary from saved activities.

### Progress Log
- 2026-04-19: Sprint initialized.
- 2026-04-20: Sprint activated after Sprint 2 completion and implementation plan lock.
- 2026-04-20: Replaced `JourneysScreen` placeholder with feature-flagged itinerary builder flow:
  - guided create itinerary sheet
  - itinerary switcher sheet
  - day selector + add-day shell
  - add-from-saved panel
  - remove/reorder/cross-day move controls
- 2026-04-20: Added itinerary domain/service layer (`src/services/itinerary.ts`) with:
  - active itinerary loading
  - optimistic mutations + reindexing
  - day-capacity and duplicate conflict detection
  - distance-only hop warnings in locale units (mi/km)
  - offline read-only snapshot fallback via AsyncStorage
- 2026-04-20: Added Sprint 3 unit coverage (`src/services/itinerary.test.ts`) for reorder/conflict/distance warning helper logic.
- 2026-04-20: Enabled Sprint 3 feature flags (`activity_details_v1_enabled`, `saved_activities_v1_enabled`, `itinerary_builder_v1_enabled`).
- 2026-04-20: Implemented true hold-and-drag reorder in Journeys (`react-native-draggable-flatlist`) while retaining button reorder controls.
- 2026-04-20: Added guest-mode persistence for saves and itinerary planner (auth deferred for development); removed active auth-route entry points from stack flow.
- 2026-04-20: Resolved Android gesture runtime integration by wrapping root app tree with `GestureHandlerRootView`.
- 2026-04-20: Sprint 3 closeout checks passed:
  - `npx tsc --noEmit`
  - `npm test -- --runInBand`
  - `npm run policy:lint`
  - `npm run sprint:end:check`
- 2026-04-20: Sprint 3 closed. Sprint 4 is unblocked.

---

## Sprint 4: Vertical Slice D - Booking Intent and Outcomes
**Status:** In Progress
**Objective:** Instrument and stabilize the booking funnel.
**Primary Outcome:** Team can track and improve booking conversion.

### Entry Criteria
- Sprint 3 acceptance gates passed.

### Scope Checklist
- [ ] Implement booking CTA from details and itinerary surfaces.
- [ ] Implement provider handoff flow (WebView/deep link per provider).
- [ ] Track booking stages: started, completed, failed, abandoned.
- [ ] Add fallback UI for provider failure and retry.
- [ ] Add commission attribution fields where available.

### Supabase Agent Prompt
```text
Create or verify SQL for booking funnel:
- booking_intents and booking_outcomes
- transition-safe status model
- dedupe guardrails
- indexed funnel queries
- owner RLS with service-role exceptions only where required
```

### Required Deliverables
- Booking intent service
- Booking status UI states
- Funnel dashboard query definitions

### Acceptance Gates
- [ ] Booking intent always recorded when CTA is triggered.
- [ ] Failure state offers clear retry or fallback action.
- [ ] Funnel query can calculate start->complete conversion.
- [ ] End-of-phase code review completed for UI/UX quality, design consistency, and any bugs/missing connections; blocking findings fixed.

### Exit Criteria
- Booking funnel is measurable and operationally debuggable.

### Progress Log
- 2026-04-19: Sprint initialized.
- 2026-04-20: Sprint activated after Sprint 3 completion.
- 2026-04-20: Implemented guest-local booking funnel service (`src/services/booking.ts`) with intent lifecycle, provider handoff transitions, outcome persistence, commission attribution fields, and auth-sync markers.
- 2026-04-20: Added booking return outcome coordinator modal (`src/components/BookingOutcomeCoordinator.tsx`) triggered on app foreground after provider redirect.
- 2026-04-20: Added Details booking CTA and status row with provider handoff + telemetry wiring.
- 2026-04-20: Added Journeys per-stop booking action and booking status chips tied to local booking state.
- 2026-04-20: Enabled `booking_tracking_v1_enabled` for Sprint 4 QA.
- 2026-04-20: Added Sprint 4 artifact set in `docs/sprint-4/`:
  - `flow-map.md`
  - `state-matrix.md`
  - `telemetry-validation-notes.md`
  - `acceptance-evidence-checklist.md`
  - `auth-sync-followup.md`
  - `funnel-query-definitions.md`
- 2026-04-22: Fixed curation bridge reliability:
  - `ExploreScreen`: satchel save now works without requiring an active itinerary; day assignment options only show when an itinerary is active.
  - `itineraryService.removeDay`: removes a day only after moving that day's activities back into saved/satchel storage.
  - `JourneysScreen`: map mode now excludes stops with missing coordinates, labels non-mappable rows, and shows a safe empty-map fallback instead of risking coordinate crashes.
- 2026-04-24: Implemented multi-itinerary targeting and creation cap guardrails:
  - `ExploreScreen` and `LocationDetailsScreen`: add flow now resolves itinerary target first (auto-create only when none exist, picker for multi-itinerary, remembered preferred target thereafter).
  - `ExploreScreen`: removed legacy city conflict create/delete prompt from city selection flow.
  - `itineraryService.createItinerary`: enforces a soft app/service cap of 5 non-archived itineraries via typed `ITINERARY_LIMIT_REACHED` errors.
  - `JourneysScreen`: create-itinerary flow now surfaces non-blocking soft warning when user attempts to create itinerary #6.
- 2026-04-26: Refined main tab navigation UX:
  - Replaced static bottom tabs with a custom floating liquid tab bar (`LiquidExpandingTabBar`) and active-state label support beneath icons.
  - Added navigation motion/sizing tokens in `src/theme/tokens.ts` for deterministic animation tuning.
- 2026-04-26: Fixed Journeys tab return flicker:
  - `JourneysScreen` now performs first-load full initialization once and uses refresh-in-place on later focus returns instead of re-entering blocking loading state.
- 2026-04-26: Restored baseline TypeScript health:
  - `ExploreScreen` callback ordering corrected to eliminate block-scoped use-before-declaration errors.
  - `JourneysScreen` invalid `TextInput` and style typing usage cleaned up for `npx tsc --noEmit` pass.
- 2026-04-26: Discovery key-boundary hardening + temporary continuity fallback:
  - `discovery.ts` now prefers edge-function actions for autocomplete/geocode/reverse-geocode with temporary dev fallback when edge deploys lag.
  - Added handoff/runbook at `docs/release/discovery-fallback-handoff.md` including production cutover steps to disable fallback before launch.
- 2026-04-27: Security hardening pass for privileged edge calls and missing RLS coverage:
  - Added scheduler/admin secret-gate enforcement (`x-edge-cron-secret`) to `notification-dispatch` and `reconcile-adventure-statuses`.
  - Added authenticated ownership verification in `generate-journey-image` before writes to `adventures`/storage.
  - Updated discovery flow to skip hero-image invoke in guest mode to avoid unauthorized privileged writes.
  - Added migration `supabase/migrations/007_security_rls_hardening.sql` to enforce owner RLS on `profiles`, `adventures`, `adventure_days`, `notification_devices`, and `notification_deliveries`.
- 2026-04-27: Retired legacy modal itinerary generation flow:
  - Removed `AdventureRequest`, `AdventureAssignment`, and `AdventureReveal` from the active root navigator route graph.
  - Deleted retired screen implementations and removed route types from `RootStackParamList`.
  - Notification intents now resolve only to `MainTabs` targets (`Home`, `Journeys`, `Passport`) with itinerary nudges routed to `Journeys`.
  - Legacy Desk CTA fallbacks now route to `MainTabs` -> `Journeys`.

---

## Sprint 5: Personalization V1 + Travis Explanations
**Status:** Not Started
**Objective:** Improve relevance while keeping recommendations grounded.
**Primary Outcome:** Users see better-ranked picks and clear reasoning.

### Entry Criteria
- Sprint 4 acceptance gates passed.

### Scope Checklist
- [ ] Capture onboarding preferences.
- [ ] Implement rules-based ranking pipeline.
- [ ] Add novelty constraints to reduce repetition.
- [ ] Ingest behavior events into ranking features.
- [ ] Implement "Top Picks" rail by destination.
- [ ] Integrate explanation generation with validated LLM output schema.
- [ ] Add deterministic fallback copy for model errors/timeouts.
- [ ] Design and implement Passport screen v1 (default/loading/empty/error states + accessibility pass).
- [ ] Design and implement Profile screen v1 (settings clarity, notice feedback, accessibility pass).
- [ ] Complete API-live setup hardening for release (provider key boundary enforcement + deployment config alignment).

### Supabase Agent Prompt
```text
Create or verify SQL for personalization data:
- user_preferences
- activity_events with constrained event types
- recency indexes
- helper views for ranking feature extraction
- strict RLS
```

### Required Deliverables
- Ranking service v1
- Explanation service with safety validation
- Personalization telemetry report format
- Passport screen v1 implementation + UX state matrix
- Profile screen v1 implementation + UX state matrix
- API-live setup checklist with verification evidence

### Acceptance Gates
- [ ] Ranking reflects explicit preferences in test fixtures.
- [ ] Explanation text never contradicts structured facts.
- [ ] Timeout path returns usable fallback copy.
- [ ] Passport and Profile screens satisfy UX/accessibility contract states and no dead-end flows.
- [ ] Android preview build uses production-safe key boundaries (client restricted key only; web-service keys server-side).
- [ ] Deployment pipeline readiness checklist passes (`lint`, `tsc`, `tests`, `expo-doctor`, preview build).

### Exit Criteria
- Relevance and explainability work together without trust regressions.

### Progress Log
- 2026-04-19: Sprint initialized.
- 2026-04-26: Re-anchored backlog to include deferred Passport/Profile design work and API-live setup hardening so release-critical work stays explicitly tracked.

---

## Sprint 6: Re-engagement, Reliability, and Permission Hardening
**Status:** Not Started
**Objective:** Make real-world usage dependable and repeatable.
**Primary Outcome:** Users can return and continue progress under imperfect conditions.

### Entry Criteria
- Sprint 5 acceptance gates passed.

### Scope Checklist
- [ ] Build notification permission flow with clear value explanation.
- [ ] Implement reminder triggers for saved items and upcoming itinerary slots.
- [ ] Implement quiet-hour enforcement and notification preference controls.
- [ ] Add deep-link destinations for each notification type.
- [ ] Add offline cache and reconciliation for critical user state.
- [ ] Harden retries and backoff for provider requests.
- [ ] Validate denied-location path with manual destination fallback.

### Supabase Agent Prompt
```text
Create or verify SQL for notification and reliability support:
- notification preferences
- token lifecycle table
- optional reminder queue
- policy boundaries for scheduler/service role writes
```

### Required Deliverables
- Notification workflow implementation
- Offline sync/reconciliation logic
- Reliability incident checklist

### Acceptance Gates
- [ ] Deep links resolve to exact intended screens.
- [ ] Denied permissions do not block critical product flow.
- [ ] Offline state preserves user intent and reconciles correctly.

### Exit Criteria
- Core journeys survive low-connectivity and denied-permission conditions.

### Progress Log
- 2026-04-19: Sprint initialized.

---

## Sprint 7: Hardening and Release Candidate
**Status:** Not Started
**Objective:** Achieve production readiness.
**Primary Outcome:** Release candidate meets quality, performance, and security bars.

### Entry Criteria
- Sprint 6 acceptance gates passed.

### Scope Checklist
- [ ] Run E2E tests for all core journeys.
- [ ] Complete accessibility audit and fixes.
- [ ] Complete Android performance profiling and fixes.
- [ ] Run dependency and secret-leak audits.
- [ ] Validate RLS and auth boundaries with adversarial tests.
- [ ] Validate LLM safety handling.
- [ ] Resolve all critical/high defects.
- [ ] Finalize rollback and incident response plan.

### Supabase Agent Prompt
```text
Run security-focused SQL audit on all new/changed policies and tables.
Return exact SQL fixes plus validation queries for each finding.
```

### Required Deliverables
- Release candidate build
- Quality gate report
- Security audit report
- Rollback runbook

### Acceptance Gates
- [ ] Critical defects = 0.
- [ ] High defects have approved disposition.
- [ ] Security findings resolved or accepted with explicit risk signoff.

### Exit Criteria
- Build is eligible for staged production rollout.

### Progress Log
- 2026-04-19: Sprint initialized.

---

## Sprint 8: Launch and Monetization Baseline
**Status:** Not Started
**Objective:** Launch production and validate revenue instrumentation.
**Primary Outcome:** Stable launch with measurable funnel and monetization signals.

### Entry Criteria
- Sprint 7 acceptance gates passed.

### Scope Checklist
- [ ] Enable commission reporting.
- [ ] Enable featured placement controls (if included).
- [ ] Enable entitlement checks for premium features (if included).
- [ ] Finalize store assets, legal documents, and support playbooks.
- [ ] Execute staged rollout and live monitoring.
- [ ] Triage launch-week incidents daily.

### Supabase Agent Prompt
```text
Create or verify monetization reporting views:
- commission views
- entitlement state tables/views
- featured placement metadata
- secure access policies
```

### Required Deliverables
- Production launch report
- Funnel baseline dashboard snapshot
- Launch-week issue log

### Acceptance Gates
- [ ] Launch completed without blocking incidents.
- [ ] Core funnel telemetry validated in production.
- [ ] Monetization instrumentation queryable and accurate.

### Exit Criteria
- Product is live with stable metrics and operational support.

### Progress Log
- 2026-04-19: Sprint initialized.

---

## Sprint 9: Post-Launch Optimization (Personalization V2/V3)
**Status:** Not Started
**Objective:** Improve conversion and retention with measured experiments.
**Primary Outcome:** Recommendation quality and repeat usage improve with evidence.

### Entry Criteria
- Sprint 8 acceptance gates passed.

### Scope Checklist
- [ ] Add collaborative filtering features.
- [ ] Add ranking experiments and holdout cohorts.
- [ ] Refine search relevance from production query logs.
- [ ] Expand provider coverage only when demand/conversion supports it.
- [ ] Optimize completion and booking nudges.
- [ ] Schedule quarterly performance and security recertification.

### Supabase Agent Prompt
```text
Create or verify SQL/jobs for experimentation and recommendation features:
- user-item interaction views
- recency-weighted features
- experiment cohort assignment tables
- efficient indexes for batch recommendation jobs
```

### Required Deliverables
- Experimentation plan and results template
- Optimization backlog with priority scores
- Quarterly recertification checklist

### Acceptance Gates
- [ ] At least one measurable recommendation KPI improves.
- [ ] Experiment assignment and analysis are reproducible.
- [ ] Next optimization roadmap is approved.

### Exit Criteria
- Continuous improvement loop is operational and measurable.

### Progress Log
- 2026-04-19: Sprint initialized.
