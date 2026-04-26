---
name: navigation-architecture
description: Navigation architecture standards for state continuity, deep-link correctness, and predictable route behavior.
---

# Navigation Architecture

## Use When
- Defining route graph, deep links, back behavior, and screen entry logic.

## Required Inputs
- Core user flows
- Route ownership map
- Notification deep-link requirements

## Workflow
1. Define route graph by domain.
2. Define entry/exit transitions for each major flow.
3. Define deep-link map for notifications and booking callbacks.
4. Define Android back behavior and stack pruning rules.
5. Validate context preservation across route switches.

## Required Outputs
- Route graph documentation
- Deep-link routing table
- Back-stack behavior rules
- Navigation error/recovery rules

## Acceptance Gates
- No duplicate or orphaned route pushes
- No dead-end route without return path
- Deep links resolve to correct screen and state
- Context (query/filter/selection) survives expected transitions
- Tab-to-tab returns do not flash blocking full-screen loading when refresh-in-place is sufficient

## Non-Negotiables
- Navigation state leaks across unrelated domains are not allowed.
- Notification deep links cannot land in ambiguous screens.
- Primary bottom-tab navigation must preserve legible active-state labeling and predictable focus behavior.
