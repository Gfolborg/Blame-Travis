# Blame Travis Sprint Roadmap

**Last Updated:** 2026-04-19
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
**Status:** In Progress
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
- [ ] Query + filter updates return stable results.
- [ ] Map/list selected item stays synchronized.
- [ ] No-result state provides at least one recovery action.
- [ ] Median local UI interaction response < 100ms.

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

---

## Sprint 2: Vertical Slice B - Activity Details and Save
**Status:** Not Started
**Objective:** Turn discovery into intent by enabling detail inspection and saving.
**Primary Outcome:** Users can save and manage activity choices confidently.

### Entry Criteria
- Sprint 1 acceptance gates passed.

### Scope Checklist
- [ ] Build details view with provider-attributed facts.
- [ ] Add "Why Travis picked this" explanation with grounded inputs.
- [ ] Implement save/unsave with optimistic update and failure rollback.
- [ ] Keep save state consistent across list, map, and details.
- [ ] Cache recent details for faster return navigation.
- [ ] Emit detail/save telemetry events.

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
- [ ] Save state consistency verified across all surfaces.
- [ ] Save failure fallback preserves user clarity.
- [ ] Screen reader announces save-state changes.

### Exit Criteria
- Saved list behavior is deterministic and persistent.

### Progress Log
- 2026-04-19: Sprint initialized.

---

## Sprint 3: Vertical Slice C - Itinerary Builder
**Status:** Not Started
**Objective:** Convert saved intent into a practical, editable itinerary.
**Primary Outcome:** Users can organize activities into a usable schedule.

### Entry Criteria
- Sprint 2 acceptance gates passed.

### Scope Checklist
- [ ] Build itinerary page grouped by day.
- [ ] Implement add/remove/reorder item behavior.
- [ ] Add conflict checks for overlapping time windows.
- [ ] Add rough travel-time sanity warnings.
- [ ] Add itinerary summary metrics.
- [ ] Add offline read support for active itinerary.
- [ ] Add empty-state CTA routing back to Explore.

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
- [ ] Reorder behavior persists across reload.
- [ ] Conflict warnings are accurate in test scenarios.
- [ ] Offline itinerary read works without crashes.

### Exit Criteria
- Users can form and edit an itinerary from saved activities.

### Progress Log
- 2026-04-19: Sprint initialized.

---

## Sprint 4: Vertical Slice D - Booking Intent and Outcomes
**Status:** Not Started
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

### Exit Criteria
- Booking funnel is measurable and operationally debuggable.

### Progress Log
- 2026-04-19: Sprint initialized.

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

### Acceptance Gates
- [ ] Ranking reflects explicit preferences in test fixtures.
- [ ] Explanation text never contradicts structured facts.
- [ ] Timeout path returns usable fallback copy.

### Exit Criteria
- Relevance and explainability work together without trust regressions.

### Progress Log
- 2026-04-19: Sprint initialized.

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
