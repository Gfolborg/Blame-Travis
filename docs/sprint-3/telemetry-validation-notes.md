# Sprint 3 Telemetry Validation Notes

## Event Wiring Scope

| Event | Trigger Point | Required Fields Covered |
|---|---|---|
| `itinerary_created` | Successful create sheet submission | `itinerary_id`, `destination_city`, `start_date`, `end_date` |
| `itinerary_item_added` | Add from saved into selected day | `itinerary_id`, `activity_id`, `day_index`, `position_index` |
| `itinerary_item_removed` | Remove item action | `itinerary_id`, `activity_id`, `day_index` |
| `itinerary_item_reordered` | Move up/down, drag drop, cross-day move | `itinerary_id`, `day_index`, `from_index`, `to_index` (+ `cross_day` metadata) |

## Validation Notes
1. Telemetry dispatch uses existing `exploreService.trackEvent` pipeline.
2. Activity ID values are sourced from normalized itinerary/saved entities.
3. Reorder telemetry includes source metadata (`buttons` or `drag`) for QA comparison.

## Automated Evidence
- `npx tsc --noEmit` PASS
- `npm test -- --runInBand` PASS
- `npm run policy:lint` PASS
- `npm run sprint:end:check` PASS

## Manual Validation Checklist
1. Create itinerary and verify one `itinerary_created`.
2. Add saved activity and verify one `itinerary_item_added`.
3. Remove added item and verify one `itinerary_item_removed`.
4. Reorder within day using up/down and verify `itinerary_item_reordered`.
5. Reorder via long-press pick/drop and verify `itinerary_item_reordered` with source metadata.
6. Move item to adjacent day and verify reorder event with cross-day metadata.
