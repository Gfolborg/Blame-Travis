---
name: screen-composer
description: Screen-level implementation standards for hierarchy, state coverage, and conversion-focused interactions.
---

# Screen Composer

## Use When
- Implementing or refactoring product screens and screen-level interaction flows.

## Required Inputs
- Screen objective
- State matrix
- Component dependencies
- Navigation entry/exit behavior

## Workflow
1. Define above-the-fold objective and primary CTA.
2. Build screen with reusable primitives.
3. Implement all required states.
4. Ensure list/map/detail/save/booking context consistency.
5. Validate one-handed reach and scan speed.
6. Validate accessibility semantics.

## Required Outputs
- Screen composition outline
- State implementation checklist
- CTA visibility validation notes
- Screen QA notes

## Acceptance Gates
- Primary action is unambiguous
- Required states are implemented and testable
- No dead-end state exists
- Travis voice usage is context-appropriate

## Non-Negotiables
- No screen ships with missing recovery states.
- No critical CTA hidden behind non-obvious gestures.
