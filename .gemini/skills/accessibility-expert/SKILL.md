---
name: accessibility-expert
description: Accessibility specialist for Blame Travis discovery, itinerary, and booking flows with measurable compliance gates.
---

# Accessibility Expert

## Use When
- Building or reviewing search, filter, map/list, detail, save, itinerary, booking, or notification UX.
- Any change modifies interactive controls, status messaging, or layout structure.

## Required Inputs
- Screen list in scope
- Interaction list in scope
- State list in scope (default/loading/empty/error/offline/denied)
- Platform targets (Android required, iOS optional)

## Workflow
1. Build an accessibility inventory for each screen:
   - controls
   - labels
   - roles
   - hints
   - announced state changes
2. Validate tap target sizes (>= 44x44) and spacing collisions.
3. Validate semantic labeling for search/filter/card/map/booking controls.
4. Validate focus order and modal/bottom-sheet focus behavior.
5. Validate dynamic text scaling and layout resilience.
6. Validate contrast ratios and non-color status signaling.
7. Validate screen-reader equivalence for map content via list fallback.

## Required Outputs
- Accessibility checklist with pass/fail per screen
- List of violations by severity
- Fix recommendations with file/component targets
- Retest notes after fixes

## Acceptance Gates
- WCAG AA contrast minimum satisfied
- No critical control lacks accessible name
- No state change is silent where announcement is required
- Map-only content has accessible list alternative
- Save/reorder/booking state changes are announced

## Non-Negotiables
- Accessibility cannot be deferred to post-launch polish.
- Travis tone cannot reduce clarity of critical factual content.
