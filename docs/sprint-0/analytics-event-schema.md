# Analytics Event Schema (travel-v1)

**Date:** 2026-04-19  
**Purpose:** Define canonical event names and payload contracts for the travel-discovery funnel.

## Global Envelope (Required for Every Event)
```json
{
  "event_name": "explore_search_submitted",
  "event_version": 1,
  "occurred_at": "2026-04-19T19:05:00Z",
  "user_id": "uuid-or-guest-id",
  "session_id": "uuid",
  "request_id": "uuid",
  "platform": "ios|android|web",
  "app_version": "x.y.z",
  "payload": {}
}
```

## Naming Rules
- Lowercase snake_case only.
- Prefix by domain: `explore_`, `filter_`, `map_`, `details_`, `save_`, `itinerary_`, `booking_`, `notification_`, `error_`.
- No ad-hoc event names in app code.

## Event Catalog
| Event Name | Trigger | Required Payload Fields |
|---|---|---|
| `explore_viewed` | Explore screen appears | `entry_source` |
| `explore_search_submitted` | User submits search | `query`, `destination`, `near_me`, `search_session_id` |
| `explore_search_results_loaded` | Search result success | `search_session_id`, `result_count`, `latency_ms`, `provider_mix` |
| `explore_search_no_results` | Zero results | `search_session_id`, `applied_filter_count`, `query_present` |
| `filter_sheet_opened` | Filter panel opened | `search_session_id` |
| `filter_applied` | Filter value committed | `search_session_id`, `filter_group`, `selected_count`, `selection_values` |
| `filter_cleared` | Filter group cleared | `search_session_id`, `filter_group` |
| `filter_max_selection_reached` | 3-item max hit | `search_session_id`, `filter_group`, `attempted_value` |
| `sort_changed` | Sort order changed | `search_session_id`, `sort_key`, `sort_direction` |
| `map_view_toggled` | Map/list toggle used | `search_session_id`, `view_mode` |
| `map_pin_selected` | Pin tapped | `search_session_id`, `activity_id`, `position_index` |
| `list_card_selected` | Card tapped | `search_session_id`, `activity_id`, `position_index` |
| `activity_details_viewed` | Details opened | `activity_id`, `search_session_id`, `entry_source` |
| `activity_details_load_failed` | Details failed | `activity_id`, `error_code`, `retryable` |
| `activity_saved` | Save action success | `activity_id`, `search_session_id`, `source_context` |
| `activity_unsaved` | Unsave action success | `activity_id`, `source_context` |
| `save_action_failed` | Save/unsave failed | `activity_id`, `operation`, `error_code` |
| `itinerary_created` | New itinerary created | `itinerary_id`, `destination_city`, `start_date`, `end_date` |
| `itinerary_item_added` | Activity added to itinerary | `itinerary_id`, `activity_id`, `day_index`, `position_index` |
| `itinerary_item_removed` | Activity removed | `itinerary_id`, `activity_id`, `day_index` |
| `itinerary_item_reordered` | Reorder complete | `itinerary_id`, `day_index`, `from_index`, `to_index` |
| `itinerary_day_completed` | Day marked complete | `itinerary_id`, `day_index`, `completed_item_count` |
| `booking_intent_started` | User taps book CTA | `activity_id`, `provider`, `itinerary_id`, `itinerary_item_id` |
| `booking_provider_opened` | Provider page/webview shown | `booking_intent_id`, `provider`, `surface` |
| `booking_outcome_recorded` | Outcome saved | `booking_intent_id`, `outcome_status`, `total_minor`, `currency` |
| `booking_outcome_failed` | Outcome write failed | `booking_intent_id`, `error_code` |
| `notification_scheduled` | Reminder scheduled | `notification_type`, `target_at`, `itinerary_id` |
| `notification_opened` | User opens push/in-app notice | `notification_id`, `notification_type` |
| `provider_fallback_used` | Provider fallback path used | `failed_provider`, `fallback_provider`, `reason_code` |
| `screen_error_rendered` | UI error state shown | `screen_name`, `error_code`, `retryable` |

## Payload Constraints
1. `query` max length: 200.
2. `selection_values` max 3 values per filter group.
3. `provider_mix` serialized as `{provider: count}`.
4. No PII in payload fields beyond user ID/session IDs.

## Derived Metrics
- Search-to-details CTR.
- Details-to-save conversion.
- Save-to-itinerary conversion.
- Booking intent rate per destination/category.
- Booking confirmation rate by provider.
- Zero-result rate by filter group.

## Validation Requirements
- Runtime event validator rejects unknown `event_name`.
- Missing required payload field fails telemetry submission.
- Event tests cover all catalog entries with sample payload fixtures.
