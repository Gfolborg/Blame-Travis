# Sprint 3 Flow Map: Itinerary Builder

## Primary Route
`MainTabs -> Journeys`

## Core Flows
1. Open Journeys
   - If itinerary exists in current mode (guest/local or authenticated): load active itinerary builder.
   - If no itinerary: show empty create state.
   - If network fails and snapshot exists: open read-only offline snapshot.
2. Create itinerary
   - Open create sheet.
   - Validate title/destination/date order.
   - Insert itinerary, then reload builder on new itinerary.
3. Switch itinerary
   - Open switcher sheet.
   - Select itinerary from non-archived list.
   - Reload builder context.
4. Build day plan
   - Select day pill.
   - Add day shell (local selection shell for empty day planning).
   - Open Add From Saved panel.
   - Add saved activity into selected day.
5. Edit day plan
   - Remove item.
   - Reorder within day via move up/down.
   - Long-press pick/drop reorder mode.
   - Move item to previous/next day.
6. Review warnings
   - Day conflict checks:
     - duplicate activity in day
     - day capacity >= 6
   - Distance hop warnings:
     - medium >= 15 mi/km
     - high >= 30 mi/km

## Recovery Paths
1. Error state -> Retry action.
2. No itinerary -> Create Itinerary or Go To Explore.
3. No saved activities in Add panel -> Go To Explore.
4. Offline snapshot banner -> Refresh to reconnect; edits blocked while offline.
