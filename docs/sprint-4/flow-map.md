# Sprint 4 Flow Map: Booking Intent and Outcome Tracking

## Primary Routes
- `LocationDetails` booking CTA
- `MainTabs -> Journeys` per-stop booking action

## Core Booking Flows
1. Start booking from Details
   - User taps `BOOK NOW`.
   - App creates booking intent (`initiated`).
   - App opens provider handoff via external deep link/browser.
   - Intent transitions to `provider_redirected`.
2. Start booking from Journeys stop card
   - User taps booking action on an itinerary item.
   - App creates booking intent with itinerary context.
   - App opens provider handoff via external deep link/browser.
3. Return from provider
   - On app foreground, pending intent is detected.
   - Outcome sheet appears immediately.
   - User records outcome (booked/cancelled/refunded/attended/no_show) or marks abandoned.
   - Intent/outcome state updates in local booking model.

## Recovery Paths
1. Missing provider URL -> intent marked failed, error notice shown.
2. Deep link open failure -> intent marked failed, retry guidance shown.
3. Outcome sheet dismissed -> intent remains redirected, can be completed later.
4. User selects abandoned -> intent marked abandoned with explicit status.
