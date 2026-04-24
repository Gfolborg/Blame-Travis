# Sprint 3 Journeys State Matrix

## Screen: Journeys (Itinerary Builder)

| State | Trigger | UI Output | User Recovery |
|---|---|---|---|
| Default | Active itinerary loaded (guest/local or authenticated) | Header, day strip, warnings, day list, actions | Continue planning |
| Loading | Initial data fetch | Full-screen loader + loading copy | Wait |
| Empty (No Itinerary) | User has zero itineraries in current mode (guest/local or authenticated) | Create Itinerary CTA + Go To Explore CTA | Create itinerary or discover saves |
| Empty (No Day Items) | Selected day has zero items | Empty day card + Open Saved Activities CTA | Add from saved |
| Empty (No Saved Activities) | Add panel loads saved list as empty | Add panel empty state + Go To Explore CTA | Save activities in Explore |
| Error | Builder load fails and no snapshot exists | Error state + Retry button | Retry |
| Offline Read-Only | Network load fails and snapshot exists | Offline banner + stale timestamp; mutations disabled | Refresh when online |

## Mutation State

| Mutation | Success Behavior | Failure Behavior |
|---|---|---|
| Add to day | Bundle updates, announce save, telemetry event | Notice error, announce failure, no stale optimistic residue |
| Remove item | Bundle updates, announce removal, telemetry event | Notice error, announce failure |
| Reorder item | Bundle updates, announce reorder, telemetry event | Notice error, announce failure |
| Move cross-day | Bundle updates, announce move, telemetry event | Notice error, announce failure |
| Create itinerary | Sheet closes, builder reloads on new itinerary, telemetry event | Notice error, sheet remains open for correction |

## Accessibility Announcements
- Added to itinerary day
- Removed from itinerary day
- Itinerary order updated
- Moved item to day N
- Failed to add/remove/reorder/move
- Picked up `<item>` in drag mode
