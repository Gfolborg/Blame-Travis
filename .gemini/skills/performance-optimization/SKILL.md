---
name: performance-optimization
description: Performance engineering rules for search-heavy mobile flows with Android-first frame and latency targets.
---

# Performance Optimization

## Use When
- Optimizing list/map interactions, search/filter updates, itinerary rendering, or asset loading.

## Required Inputs
- Performance budget targets
- Critical interaction list
- Device test matrix

## Workflow
1. Identify hot paths:
   - search input updates
   - filter application
   - list/map toggles
   - itinerary reorder
2. Apply render optimization strategy:
   - memoization
   - state locality
   - virtualization
3. Apply IO optimization strategy:
   - debouncing
   - throttling
   - caching
4. Profile on target Android devices.
5. Record bottlenecks and implement focused fixes.

## Required Outputs
- Hot-path inventory
- Performance profiling report
- Optimization diff summary
- Remaining risk list

## Acceptance Gates
- Core interactions feel immediate and consistent
- List/map transitions avoid noticeable jank
- Excessive redundant network calls removed
- Profiling confirms improvements on target devices

## Non-Negotiables
- No optimization work without measurable before/after evidence.
- No regression to accessibility or correctness for speed gains.
