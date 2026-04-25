---
name: itinerary-engine
description: Deterministic ranking and itinerary-assembly rules using grounded data and explicit scoring logic.
---

# Itinerary Engine

## Use When
- Implementing recommendation ranking, diversity controls, and itinerary assembly behavior.

## Required Inputs
- Canonical activity data
- User preference profile
- Search/filter context
- Behavior signal inputs

## Workflow
1. Compute candidate activity set from grounded provider data.
2. Apply feasibility checks (open, reachable, budget-aligned).
3. Apply preference fit scoring.
4. Apply novelty/diversity constraints.
5. Rank and select output set.
6. Assemble itinerary proposal from saved items with schedule sanity checks.
7. Generate explanation text separately from scoring logic.

## Required Outputs
- Ranking function specification
- Weighting and tie-break definitions
- Novelty constraint rules
- Itinerary assembly rule set
- Explanation payload schema

## Acceptance Gates
- Ranking output is reproducible for same input set
- Infeasible items are excluded with explicit reason
- Repetition controls function as designed
- Explanation text does not alter ranking facts

## Non-Negotiables
- No hidden scoring heuristics without documentation.
- No LLM-generated facts entering ranking logic.
- Itinerary creation behavior must enforce active-cap limits consistently across all add/create entry points.
