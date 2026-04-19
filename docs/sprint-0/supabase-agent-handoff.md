# Supabase AI Agent Handoff Package

Use this exact package when asking your Supabase SQL agent to execute the DB migration work.

## 1) Copy/Paste Prompt (Use As-Is)
```text
You are implementing a non-destructive Supabase migration for Blame Travis (travel-v1).

Context:
- Current model is legacy adventure-centric (`adventures`, `adventure_days`).
- Target model is activity-discovery and booking-centric.
- Do NOT drop legacy tables in this pass.
- All user-owned tables must enforce RLS.
- Output SQL must be idempotent where feasible and safe for staged rollout.

Target tables to create/verify:
1. user_preferences
2. activities
3. activity_sources
4. activity_provider_refs
5. search_sessions
6. activity_events
7. saved_activities
8. itineraries
9. itinerary_items
10. booking_intents
11. booking_outcomes

Mandatory requirements:
- Include enums/check constraints for status fields.
- Include updated_at trigger strategy.
- Include unique/index strategy:
  - activities.canonical_key unique
  - saved_activities unique(user_id, activity_id)
  - itinerary_items unique(itinerary_id, day_index, position_index)
  - booking_outcomes unique(booking_intent_id)
- Include strict FK constraints.
- Add RLS for each user-owned table using auth.uid().
- Provide service-role exceptions only where needed.
- Include migration sequence with explicit order and dependency notes.
- Include backfill SQL from legacy tables (`profiles`, `adventures`, `adventure_days`) into new model.
- Include verification queries for counts, duplicates, and orphans.
- Include rollback steps that are non-destructive.

Output format (exact headings):
1. ASSUMPTIONS
2. MIGRATION ORDER
3. SQL: SCHEMA + CONSTRAINTS + INDEXES
4. SQL: RLS POLICIES
5. SQL: BACKFILL
6. SQL: VALIDATION QUERIES
7. SQL: ROLLBACK STEPS
8. RISKS AND MITIGATIONS
9. OPEN QUESTIONS

Important:
- Do not use vague placeholders like "add indexes as needed".
- Provide concrete SQL for every required table/policy.
- Prefer transactional blocks with comments indicating safe re-runs.
```

## 2) Required Response Quality Bar
Reject the agent output if any item below is missing:
1. One or more target tables are absent.
2. RLS not present for all user-owned tables.
3. Required unique constraints missing.
4. No backfill SQL for legacy data.
5. No validation query pack.
6. No explicit rollback steps.
7. Uses destructive drops in initial rollout.

## 3) What You Should Reply Back With
Ask the Supabase agent to revise with this strict instruction if needed:
```text
Revise and resubmit. Your previous output did not meet the required format and safety constraints.
Keep the same 9-section heading structure and provide concrete SQL for missing sections.
No destructive operations in this pass.
```

## 4) Acceptance Checklist Before Running SQL
- [ ] SQL files are ordered and dependency-safe.
- [ ] Every new table has created_at/updated_at.
- [ ] Every user-owned table has RLS + owner policy.
- [ ] Required unique/index constraints exist.
- [ ] Backfill scripts are idempotent or guarded.
- [ ] Validation queries return expected shape.
- [ ] Rollback path documented and reversible without data loss.

## 5) Integration Handoff Back to App Team
Once SQL is accepted, request from the agent:
1. Migration filenames in execution order.
2. Any manual preconditions.
3. Estimated runtime and lock-risk notes.
4. Post-run verification checklist with pass/fail fields.
