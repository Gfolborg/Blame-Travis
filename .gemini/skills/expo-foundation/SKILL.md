---
name: expo-foundation
description: App architecture and runtime standards for Expo/React Native implementation quality.
---

# Expo Foundation

## Use When
- Establishing architecture, app services, runtime configuration, or shared infrastructure.

## Required Inputs
- Canonical domain contracts
- Provider integration requirements
- Performance and security constraints
- Offline and sync requirements

## Workflow
1. Organize code by domain boundaries:
   - search
   - activities
   - itinerary
   - booking
   - profile
   - notifications
2. Define typed interfaces and validators for external payloads.
3. Implement provider adapters and error normalization.
4. Implement state/data layer patterns for cache and invalidation.
5. Validate Android-first performance paths.
6. Validate secret and environment handling boundaries.

## Required Outputs
- Domain module map
- API contract interfaces + validators
- Service adapter implementations
- Runtime configuration checklist

## Acceptance Gates
- No untyped external payload usage
- No provider secret exposed client-side
- Core data flows support retry and error boundaries
- Android performance baseline holds on target devices

## Non-Negotiables
- No `any` in critical domain paths.
- No direct API calls bypassing adapter layer.
