# Gemini CLI Guidelines - Blame Travis

Operational contract for Gemini-style agents working in this repository.

This file must stay synchronized with `AGENTS.md`, `phases.md`, and all local skills.

## 1. Primary Objective

Deliver a production-grade travel activity app where users can discover, save, plan, and book activities with Travis-led tone.

## 2. Mandatory Product Behavior

Required user flow:
1. Search/browse activities.
2. Refine using high-impact filters.
3. Switch between list and map without context loss.
4. Inspect detailed activity facts.
5. Save/curate into satchel or assign to itinerary day.
6. Organize itinerary by day.
7. Trigger booking intent and outcome tracking.
8. Re-engage users with meaningful reminders.

## 3. Data Grounding Rules

Always treat structured APIs as factual truth.

Do not allow LLM text to define or override:
- places
- hours
- pricing
- availability
- routing facts

LLM role is limited to:
- ranking explanation
- itinerary narrative framing
- nudges and motivational copy

## 4. Scope and Release Discipline

MVP includes:
- search, filters, list/map, details
- save and itinerary builder
- booking intent and outcome analytics
- rules-based personalization

MVP excludes:
- broad OTA flight/hotel stack
- uncontrolled filter sprawl
- ungrounded AI itinerary generation

## 4.1 Itinerary Targeting Discipline

- Auto-create an itinerary only when none exists.
- When itineraries exist, add flows must select an existing itinerary target before day assignment.
- Persist the last selected itinerary target and reuse it until changed.
- Enforce a maximum of 5 non-archived itineraries; show soft warning only on attempted creation beyond that limit.

## 5. UI/UX Standards

Required for every touched screen:
- default state
- loading state
- empty state
- no-result state
- error state
- offline state
- denied-permission state
- safe map degradation for missing coordinates when map mode is present
- legacy modal itinerary generation routes (`AdventureRequest`, `AdventureAssignment`, `AdventureReveal`) are retired and cannot be used as active product entrypoints
- bottom-tab active labels remain legible without truncation artifacts
- active bottom-tab treatment stays icon-first with optional label support beneath icon
- returning to Journeys via tab switch refreshes in-place after first load (no full-screen flicker)
- passport auto-stamping runs foreground-only in MVP; stamp automatically when user remains within ~500ft of an active-itinerary stop for ~120s
- passport experience cannot require manual "stamp this place" actions
- profile v1 prioritizes core controls only (account, notifications, permissions, privacy); do not surface Travis tone/default controls in the primary profile surface

Interaction requirements:
- clear primary action
- one-handed reach for primary CTA on common screen sizes
- zero dead-end recovery paths

## 6. Voice and Tone Rules

Travis copy must be:
- direct
- adventurous
- lightly sarcastic
- motivating
- respectful

Never use:
- militarized metaphors
- punitive guilt framing
- threatening language

## 7. Engineering Standards

- strict type contracts at API edges
- provider adapter boundaries
- deterministic error envelopes
- no secret values in client bundle
- no `Alert.alert` for core product messaging

## 8. Performance Targets

- target 60fps on mid-range Android for list/map interactions
- debounced search input
- throttled map-bound fetches
- avoid full-list rerenders for minor filter changes

## 9. Security and Privacy Standards

- RLS required for user-owned data tables
- least-privilege data access policies
- server-side handling for sensitive provider integrations
- LLM prompt and output safety checks
- explicit, clear permission rationale and fallbacks
- temporary client-side provider fallback paths are allowed only for development continuity and must be removed/disabled before production release
- privileged scheduler/admin edge functions must require a non-public shared secret gate (for example `x-edge-cron-secret`)
- privileged write edge functions must enforce authenticated ownership checks before mutating user-owned records

## 10. Sprint-Based Delivery Rules

Use `phases.md` sprint roadmap as execution source.

A sprint closes only when:
- implementation is complete
- tests pass
- acceptance gates pass
- docs are updated
- risks are logged
- `npm run sprint:end:check` passes without blocking policy errors

## 11. Skill-First Execution

Before substantial work, activate the most relevant local skill under `.gemini/skills`.

Skill output must include:
- concrete decisions
- implementation plan
- acceptance checks
- handoff notes when cross-skill coordination is needed

## 12. Documentation Sync Rules

Any behavior or architecture change must update:
- `README.md`
- `AGENTS.md`
- `gemini.md`
- `phases.md`
- impacted `SKILL.md` files

No policy drift allowed.

## 13. Collaboration Rules

- Explain tradeoffs when challenging a request.
- Ask clarifying questions only when assumptions are materially risky.
- Keep work transparent and explicitly scoped.
- Prefer deterministic, testable decisions over vague recommendations.

## 14. Cross-Agent Alignment (No Contradictory Rewrites)

When collaborating with Codex or another active agent stream:
- Treat the current checked-in code and latest phase log as the implementation source of truth.
- Extend existing contracts before proposing replacement contracts.
- Do not rewrite shipped architecture patterns unless explicitly requested by user decision.
- Before major edits, review recent changes in:
  - `phases.md`
  - `AGENTS.md`
  - touched implementation files related to the active feature
- If a proposed change conflicts with recent shipped behavior, stop and surface the conflict with:
  - what currently exists
  - why the new change conflicts
  - the minimal safe path forward
- Preserve naming and schema contracts already adopted in code. Example:
  - Passport stamp-art manifest contract uses `storage_path` / `locked_storage_path` and app-side URL resolution fallback logic.
- Never silently introduce alternate parallel contracts for the same feature.
