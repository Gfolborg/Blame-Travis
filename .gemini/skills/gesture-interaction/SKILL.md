---
name: gesture-interaction
description: Deterministic gesture rules for discoverable, recoverable, and accessible mobile interactions.
---

# Gesture Interaction

## Use When
- Designing swipe, drag, sheet, map-pan, and mixed gesture interfaces.

## Required Inputs
- Target interaction list
- Gesture conflict map
- Accessibility fallback requirements

## Workflow
1. Define primary gesture and explicit tap fallback for each action.
2. Define gesture affordance visuals and discoverability hints.
3. Resolve conflicts between nested gesture zones.
4. Define cancel, rollback, and failure behavior.
5. Validate one-handed reach for primary actions.

## Required Outputs
- Gesture map by screen
- Conflict resolution notes
- Fallback interaction map
- Haptic/visual feedback matrix

## Acceptance Gates
- No critical action is gesture-only
- No accidental destructive gesture without recovery
- Gesture conflicts do not cause frozen or hijacked interactions
- Accessibility fallback is present for each gesture path

## Non-Negotiables
- Hidden gestures for essential flows are not allowed.
- Gesture complexity cannot reduce clarity.
