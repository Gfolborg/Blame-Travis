---
name: geospatial-maps
description: Map-system standards for deterministic list/map parity, geospatial performance, and location fallback behavior.
---

# Geospatial Maps

## Use When
- Building map/list views, map filtering, marker interactions, or geospatial summaries.

## Required Inputs
- Search/filter state model
- Activity location schema
- Map provider capabilities and constraints
- Permission behavior requirements

## Workflow
1. Define list/map synchronization contract.
2. Define marker model and clustering thresholds.
3. Implement viewport-driven fetch rules with throttling.
4. Implement selected-item sync between map and list.
5. Implement denied-location fallback path.
6. Validate low-connectivity behavior and cache usage.

## Required Outputs
- Map/list parity contract
- Marker/cluster rendering rules
- Geospatial fetch throttling settings
- Permission fallback behavior notes

## Acceptance Gates
- Selected activity remains consistent across list/map transitions
- Map interactions do not trigger redundant high-cost fetch loops
- Denied location does not block discovery flow
- Frame stability remains within performance targets

## Non-Negotiables
- No map-only critical information without list alternative.
- No hidden location dependency that blocks non-permission users.
