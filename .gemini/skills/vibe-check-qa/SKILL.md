---
name: vibe-check-qa
description: Functional and experiential QA standards for discovery, itinerary, booking, and retention flows.
---

# Vibe Check QA

## Use When
- Validating feature readiness before merge/release.
- Auditing interaction quality and UX coherence.

## Required Inputs
- Feature scope
- Test matrix
- Expected acceptance criteria

## Workflow
1. Run functional flow tests for impacted journeys.
2. Run UI state validation for all required states.
3. Run interaction and gesture quality checks.
4. Run platform/device matrix checks.
5. Record defects by severity with reproduction steps.

## Required Outputs
- QA report with pass/fail by flow
- Defect list with severity and owner
- Release recommendation status

## Acceptance Gates
- No critical defects remain
- High defects have accepted disposition and owner
- Core funnel flow passes end-to-end
- UX consistency checks pass for touched screens

## Non-Negotiables
- No release with unresolved critical flow breakage.
- No subjective "looks fine" signoff without test evidence.
