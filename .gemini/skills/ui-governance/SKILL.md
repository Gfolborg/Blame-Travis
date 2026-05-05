---
name: ui-governance
description: Design-system governance for token fidelity, component reuse, and visual consistency.
---

# UI Governance

## Use When
- Defining tokens, creating shared UI primitives, or auditing visual consistency.

## Required Inputs
- Token set
- Component inventory
- Visual requirements per screen

## Workflow
1. Validate token coverage for required visual attributes.
2. Map screen needs to existing components.
3. Create new primitives only when no reusable option exists.
4. Audit token usage in implementation.
5. Audit cross-platform consistency.

## Required Outputs
- Token compliance report
- Component reuse report
- New component justification (if added)
- Visual drift issues list

## Acceptance Gates
- No unauthorized hardcoded visual values
- Reusable components used consistently
- Visual hierarchy consistent with design system
- Accessibility contrast and typography standards met
- Travis surface placement remains consistent with repository policy (`AGENTS.md`/`gemini.md`/`README.md`):
  - present on required core surfaces
  - non-blocking notice-first messaging
  - no repetitive popup spam on browse flows

## Non-Negotiables
- One-off visual divergence without approval is not allowed.
- Accessibility cannot be sacrificed for brand styling.
