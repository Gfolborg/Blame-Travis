---
name: notifications-reengagement
description: Deterministic notification strategy for intent-based reminders, lifecycle nudges, and deep-link recovery.
---

# Notifications Reengagement

## Use When
- Designing push/local notification triggers, copy sets, or reminder lifecycle logic.

## Required Inputs
- Trigger events
- User preference and quiet-hour rules
- Deep-link destination map

## Workflow
1. Define trigger taxonomy:
   - saved activity follow-up
   - upcoming itinerary item
   - unfinished booking
   - post-completion return prompt
2. Define suppression logic to avoid spam.
3. Define quiet-hour enforcement and timezone behavior.
4. Define deep-link destination for each notification type.
5. Define copy variants by intensity setting.
6. Validate delivery/open/error telemetry.

## Required Outputs
- Trigger rules table
- Suppression policy
- Deep-link mapping table
- Copy matrix by tone intensity

## Acceptance Gates
- Each notification has deterministic trigger conditions
- Each notification opens a valid target screen/state
- Quiet-hour policy is respected
- Reminder frequency remains within configured limits

## Non-Negotiables
- Notifications without clear user value are not allowed.
- Missing deep-link destinations are not allowed.
