---
name: feedback-states
description: Deterministic state-design standards for loading, empty, no-result, error, offline, and permission handling.
---

# Feedback States

## Use When
- Implementing or reviewing any screen that fetches data or depends on permissions/connectivity.

## Required Inputs
- Screen list in scope
- State matrix per screen
- Recovery actions for each failure state

## Workflow
1. Enumerate mandatory states for each screen.
2. Define user-facing copy and CTA for each state.
3. Implement rendering logic that cannot silently fail.
4. Validate state transitions under network/provider failures.
5. Validate context preservation across retries.

## Required Outputs
- Per-screen state matrix
- Recovery action map
- Failure-mode test notes

## Acceptance Gates
- No unhandled state path
- Every error/no-result state has explicit recovery action
- Retries preserve current query/filter context
- Offline behavior preserves core user intent

## Non-Negotiables
- Never leave users in non-actionable dead-end states.
- Never rely on a global spinner as the only loading UX.
