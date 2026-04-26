---
name: motion-animation
description: Motion and haptic standards for clear hierarchy, feedback, and performance-safe transitions.
---

# Motion Animation

## Use When
- Implementing animated transitions, micro-interactions, or haptic feedback.

## Required Inputs
- Interaction trigger list
- Reduced-motion requirements
- Performance constraints

## Workflow
1. Define animation purpose per interaction (inform, confirm, transition).
2. Define timing, easing, and duration tokens.
3. Implement Reanimated UI-thread animations.
4. Pair high-value confirmations with calibrated haptics.
5. Validate reduced-motion alternatives.
6. Validate frame stability on Android target devices.

## Required Outputs
- Motion spec by interaction
- Reduced-motion fallback map
- Haptic usage table
- Performance validation notes

## Acceptance Gates
- Motion improves clarity and does not delay core tasks
- No animation runs on JS thread when avoidable
- Reduced-motion mode remains fully usable
- Frame drops during core flows remain within acceptable bounds
- Active navigation labels remain readable during animated state changes (no truncation artifacts)

## Non-Negotiables
- Decorative motion cannot override functional clarity.
- Blocking animations on critical actions are not allowed.
