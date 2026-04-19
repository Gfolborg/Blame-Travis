---
name: data-modeling
description: Deterministic Supabase data-model standards for discovery, itinerary, booking, and personalization systems.
---

# Data Modeling

## Use When
- Defining or modifying schema, indexes, constraints, RLS policies, or analytics views.
- Mapping provider data into canonical app models.

## Required Inputs
- Canonical entity definitions
- Query access patterns
- Retention and privacy constraints
- Migration/backfill constraints

## Target Entities
- user_preferences
- activities
- activity_sources
- activity_provider_refs
- search_sessions
- activity_events
- saved_activities
- itineraries
- itinerary_items
- booking_intents
- booking_outcomes

## Workflow
1. Define table contracts and ownership fields.
2. Add validation constraints and enums for statuses.
3. Add indexes aligned to read/write access patterns.
4. Define RLS policies for owner-only access by default.
5. Add service-role policy exceptions only where strictly required.
6. Define migration order with backfill and rollback plan.
7. Validate with sample queries and policy tests.

## Required Outputs
- SQL migration scripts
- RLS policy definitions
- Index and constraint summary
- Backfill and rollback notes
- Validation query set

## Acceptance Gates
- All user-owned tables enforce RLS
- No ambiguous status models
- Critical query paths use indexes
- Migration is reversible or safely staged
- Compatibility views exist if legacy reads remain

## Non-Negotiables
- No direct provider-secret storage in client-readable tables.
- No schema changes without migration and verification notes.
