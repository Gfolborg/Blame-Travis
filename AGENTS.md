# AGENTS.md

Repository operating contract for AI coding agents working on **Blame Travis**.

This file is the top-level policy source for agent behavior in this repository. `gemini.md`, `phases.md`, and all local skills must remain aligned with this document.

## 1. Product Definition (Non-Negotiable)

Blame Travis is a **travel activity discovery mobile app** that helps users:
1. Search and browse things to do.
2. Filter and compare options quickly.
3. Save activities into a satchel and/or assign them into an itinerary day.
4. Start booking flows with provider handoff.
5. Return and complete experiences with Travis-led motivation.

## 2. Source-of-Truth Hierarchy

1. Structured provider data for logistics facts.
2. App-owned ranking and itinerary logic.
3. LLM output only for explanation/tone framing.

The following data must never be fabricated by LLM output:
- place identity
- coordinates
- operating hours
- availability
- price
- travel-time calculations

## 3. Required Core Experience

The app must preserve this sequence in product and code:
1. Explore (search + category rails)
2. Refine (filters + sort)
3. Compare (list/map parity)
4. Inspect (activity details)
5. Save (persistent user list)
6. Plan (day-by-day itinerary)
7. Book (intent + outcome tracking)
8. Return (completion + re-engagement)

## 4. Scope Guardrails

Allowed in MVP:
- destination/near-me search
- category browsing
- high-impact filters
- list/map toggle
- saved activities
- itinerary builder
- booking intent/outcome tracking
- affiliate booking partner handoff with clear disclosure and attribution tracking

Not allowed in MVP:
- broad OTA flight/hotel expansion
- AI-only planning without grounded inventory
- hidden critical gestures
- dead-end flows requiring hard permission grants
- undisclosed sponsored ranking manipulation

## 4.2 Affiliate and Partnership Rules

- Affiliate offers must be labeled clearly (for example `Partner offer` or `Sponsored`) on all surfaces where they appear.
- Activity ranking remains relevance-first; partner boosts must be bounded and must not suppress core user-fit results.
- Primary affiliate conversion surface is activity details; secondary surface is itinerary stop actions.
- Explore list cards may show partner badges but must avoid aggressive repeated booking CTAs that degrade browse UX.
- Every affiliate click/handoff must emit attribution telemetry with partner id, placement, and activity id.
- Affiliate/partner UX is a user-helpful supplement to the core experience, not an interruption; it must remain optional and non-blocking.
- No affiliate/partner UI should render unless implementation is complete, feature flags are enabled, and at least one active partner/offer is configured.
- Affiliate surfaces must remain dark by default behind `affiliate_enabled`, `affiliate_details_enabled`, `affiliate_journeys_enabled`, and `affiliate_explore_badge_enabled` until explicit release activation.
- Expansion path is phased: activity booking partners first, then hotels/cars supplement lanes, then flights after post-launch quality and trust gates.

## 4.1 Itinerary Targeting Rules

- If no itinerary exists, the app may auto-create one from the current city context.
- If itineraries already exist, add-to-itinerary flows must require selecting an existing itinerary target before day assignment.
- The app should remember the user's last chosen itinerary target for subsequent add actions.
- Maximum active itinerary count is 5 non-archived itineraries; show soft warning only when creation of a 6th is attempted.

## 5. Voice and Copy Contract

All user-facing copy must be:
- confident
- adventurous
- lightly sarcastic
- motivating
- non-punitive

Disallowed language patterns:
- militarized metaphors
- surveillance-style guilt
- shaming tone
- threatening urgency

Preferred lexicon:
- itinerary
- passport
- stamps
- open road
- the desk
- top picks
- hidden gems

### Travis Surface Spec (Required)

Travis must be present on these user-facing surfaces:
- Explore: default/loading/empty/no-result/denied-location guidance and add-to-itinerary feedback.
- Location Details: "Why Travis picked this" narrative plus save/add/book feedback.
- Journeys: itinerary guidance, blank-day guidance, move/remove confirmations, and booking feedback.
- Booking return flow: booking outcome capture modal after provider handoff return.
- Passport return flow: auto-stamp success feedback and achievement unlock flow.
- Auth entry surfaces: splash/login/signup/onboarding brand/persona anchor.

Travis should be present (non-blocking, supportive):
- Global in-app notice layer for success/warning/error messaging (`TravisNotice`).
- Light visual mascot presence (`TravisSignal`) on key state surfaces only.
- Motivational copy on milestone moments (first stamp, chapter completion, itinerary created).

Travis must not be overused:
- no interruptive popups during normal browse/compare interactions
- no native `Alert.alert` for core product messaging
- no Travis tone/default controls in primary Profile v1 layout
- no aggressive repeated Travis CTAs that degrade minimalist discovery UX

## 6. UX and Accessibility Contract

Mandatory UX behavior:
- all key screens define default/loading/empty/error/offline/denied states
- no native `Alert.alert` for core product messaging
- map/list views remain state-synchronized
- map mode must degrade safely when itinerary stops have missing coordinates
- no dead-end no-result pages
- legacy modal itinerary generation routes (`AdventureRequest`, `AdventureAssignment`, `AdventureReveal`) must not be used for active product flows
- bottom tab navigation must keep active labels legible without truncation artifacts
- active bottom-tab state should preserve icon-first scanning with optional label support beneath icon
- tab returns to Journeys must avoid full-screen loading flicker; use refresh-in-place behavior after first load
- passport auto-stamping must run foreground-only in MVP, with automatic stamping at approximately 500ft proximity after brief dwell (~120s) for active itinerary stops
- passport progress must not depend on manual "stamp this place" actions
- profile v1 should prioritize core controls (account, notifications, permissions, privacy) and should not surface Travis tone/default controls in the primary profile layout

Mandatory accessibility rules:
- text contrast at WCAG AA minimum
- tap targets >= 44x44
- color is never the only status signal
- screen reader labels for all interactive controls
- announced state changes for save, filter, and itinerary reorder events

## 7. Engineering and Performance Contract

Mandatory engineering rules:
- strict typed contracts at API boundaries
- provider adapters isolate external payload formats
- no client-side secret leakage
- no unbounded analytics event payloads

Performance targets:
- interaction responsiveness target: under 100ms for local UI interactions
- frame stability target: 60fps on mid-range Android during list/map navigation
- search input debounced and map-bound fetches throttled

## 8. Data and Security Contract

Supabase requirements:
- RLS on all user-owned tables
- least-privilege policy model
- validated status enums and constraints
- indexed read paths for search, save, itinerary, booking events
- indexed read paths for affiliate attribution and commission reconciliation events

Security requirements:
- secrets never in public client bundles
- server-side provider signing and sensitive calls
- prompt-input and prompt-output safety validation for LLM endpoints
- temporary client-side fallback for provider web-service calls is permitted only for development continuity and must be explicitly disabled before production release
- privileged scheduler/admin edge functions must require a non-public shared secret gate (for example `x-edge-cron-secret`)
- privileged write edge functions must enforce authenticated ownership checks before mutating user-owned records
- affiliate handoff URLs and attribution writes must be server-side only (edge action contract), with active offer/partner validation before returning outbound links

## 9. Sprint Execution Contract

Delivery model is **vertical slices by user outcome**.

Each sprint must produce:
- implemented code
- data changes (if required)
- telemetry updates
- test evidence
- updated docs
- a passing `npm run sprint:end:check` result

A sprint is complete only when all sprint acceptance gates in `phases.md` are satisfied.

## 10. Skill Usage Contract

Before doing meaningful work, select the relevant local skill from `.gemini/skills`.

Skill usage is mandatory for:
- architecture decisions
- schema changes
- map behavior
- accessibility work
- performance tuning
- security review
- phase/sprint tracking updates

## 11. Documentation Sync Rules

When product behavior changes, update these files in the same change set:
- `README.md`
- `AGENTS.md`
- `gemini.md`
- `phases.md`
- affected `.gemini/skills/*/SKILL.md`

No partial policy updates are allowed.

## 12. Working Agreement

- Treat user as decision authority for tradeoffs.
- Provide explicit reasoning when rejecting risky proposals.
- Do not perform hidden scope expansion.
- Ask clarifying questions only when assumptions materially affect outcomes.

## 13. Current Skills (Canonical)

- `accessibility-expert`
- `content-tone`
- `data-modeling`
- `design-to-code-mcp`
- `expo-foundation`
- `feedback-states`
- `geospatial-maps`
- `gesture-interaction`
- `mission-engine` (frontmatter name: `itinerary-engine`)
- `motion-animation`
- `navigation-architecture`
- `notifications-reengagement`
- `performance-optimization`
- `product-architect`
- `screen-composer`
- `ui-governance`
- `vibe-check-qa`
- `vulnerability-scan`

## 14. Source-of-Truth Priority

If `AGENTS.md` and `gemini.md` diverge, align both immediately in the same task.

This file is the final repository policy reference unless user explicitly overrides it.
