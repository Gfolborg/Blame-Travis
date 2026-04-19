---
name: design-to-code-mcp
description: Screen-to-code implementation standards for high-fidelity, performant, and accessible React Native UI.
---

# Design to Code MCP

## Use When
- Converting design assets into production components.
- Auditing visual parity and interaction fidelity.

## Required Inputs
- Source design artifact references
- Token system definitions
- Target platform breakpoints
- State matrix for each component

## Workflow
1. Map all visual values to existing tokens.
2. Build reusable primitives before screen-specific wrappers.
3. Implement full state matrix per component.
4. Validate spacing, hierarchy, and typography consistency.
5. Validate accessibility semantics and dynamic type behavior.
6. Validate performance for list-heavy or map-adjacent components.

## Required Outputs
- Component implementation list with ownership
- Token mapping table
- State coverage checklist
- Fidelity audit notes (pass/fail deltas)

## Acceptance Gates
- No hardcoded visual values outside token definitions
- All required component states implemented
- Typography and spacing hierarchy match design intent
- Accessibility and performance checks pass

## Non-Negotiables
- Do not ship one-off variants when reusable primitives are possible.
- Do not defer state handling to "future polish".
