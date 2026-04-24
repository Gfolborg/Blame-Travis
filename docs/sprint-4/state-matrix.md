# Sprint 4 Booking State Matrix

## Global Booking States

| State | Trigger | UI Output | Recovery |
|---|---|---|---|
| Not Started | No intent for activity/itinerary item | `Not Started` status chip | Start booking |
| Started | Intent created before handoff | `Started` status chip | Continue to provider |
| Redirected | Provider handoff opened | `Redirected` status chip + return outcome sheet on app foreground | Record outcome or mark abandoned |
| Confirmed | Outcome recorded successfully | Status chip reflects outcome label (`Booked`, `Attended`, etc.) | Edit outcome later |
| Failed | Handoff missing URL or open failed | `Failed` status chip + error notice | Retry booking action |
| Abandoned | User marks abandoned | `Abandoned` status chip | Restart booking action |

## Screen-Level States

| Screen | State | Output |
|---|---|---|
| Location Details | Bookable | `BOOK NOW` enabled + booking status row |
| Location Details | Not bookable | `BOOKING UNAVAILABLE` disabled state |
| Journeys stop row | Bookable | Ticket action + booking status chip |
| Journeys stop row | Not bookable | Booking action shows unavailable notice |
| Return Outcome Sheet | Active | Status selection + optional fields + save/later/abandon actions |

## Accessibility Announcements
- Booking outcome saved
- Existing item drag/reorder/remove announcements remain active
