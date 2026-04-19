---
name: content-tone
description: Travis voice governance for clear, motivating copy across discovery, itinerary, booking, and retention flows.
---

# Content Tone

## Use When
- Writing or reviewing any user-facing copy.
- Adding recommendation explanations, empty states, nudges, alerts, or CTA labels.

## Required Inputs
- Surface context (screen + component)
- User intent at that point in flow
- Factual constraints (price/time/availability/provider terms)
- Desired action after reading copy

## Workflow
1. Identify copy purpose:
   - orient
   - reassure
   - prompt action
   - recover from failure
2. Draft line in Travis voice:
   - concise
   - confident
   - lightly sarcastic
   - non-punitive
3. Run factual clarity check:
   - no ambiguity in pricing/time/availability actions
4. Run tone safety check:
   - no militarized wording
   - no shame-driven language
5. Run action check:
   - user knows exact next step

## Required Outputs
- Final copy set by surface/state
- Banned phrase replacements (if found)
- Tone QA checklist results

## Acceptance Gates
- Copy communicates next action in one read
- Copy does not conflict with structured facts
- Tone is consistent across screen and notifications
- No prohibited language present

## Non-Negotiables
- Personality never obscures trust-critical information.
- Error copy must include an actionable recovery path.
