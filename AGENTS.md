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

Not allowed in MVP:
- broad OTA flight/hotel expansion
- AI-only planning without grounded inventory
- hidden critical gestures
- dead-end flows requiring hard permission grants

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

## 6. UX and Accessibility Contract

Mandatory UX behavior:
- all key screens define default/loading/empty/error/offline/denied states
- no native `Alert.alert` for core product messaging
- map/list views remain state-synchronized
- map mode must degrade safely when itinerary stops have missing coordinates
- no dead-end no-result pages
- bottom tab navigation must keep active labels legible without truncation artifacts
- active bottom-tab state should preserve icon-first scanning with optional label support beneath icon
- tab returns to Journeys must avoid full-screen loading flicker; use refresh-in-place behavior after first load

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

Security requirements:
- secrets never in public client bundles
- server-side provider signing and sensitive calls
- prompt-input and prompt-output safety validation for LLM endpoints
- temporary client-side fallback for provider web-service calls is permitted only for development continuity and must be explicitly disabled before production release

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
