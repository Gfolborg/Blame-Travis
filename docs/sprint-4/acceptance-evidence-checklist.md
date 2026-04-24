# Sprint 4 QA: Step-by-Step Acceptance Tests

## Test Preconditions (Run Once Before Testing)
- [ ] App builds and launches with no red-screen errors.
- [ ] `booking_tracking_v1_enabled` is `true`.
- [ ] At least 1 bookable activity exists (has `bookingDeepLink` or `bookingSupported=true`).
- [ ] If no known bookable activity exists, run `npm run qa:seed:booking-lane` before QA and `npm run qa:cleanup:booking-lane` after QA completes.
- [ ] Optional hard cleanup (dev only): run `npm run qa:purge:booking-lane` to fully delete seeded QA rows.
- [ ] At least 1 itinerary exists with at least 1 item for Journeys booking tests.

---

## Acceptance Gate 1: Booking Intent Recorded on Every CTA

### QA-4-01 Details Booking Intent
- **Objective:** Verify Details CTA creates booking intent and updates UI state.
- **Steps:**
1. Open a bookable activity in `LocationDetails`.
2. If needed, search for `QA Booking Lane` from Explore and open that result.
3. Verify booking status shows `Not Started`.
4. In the fixed bottom footer, locate the booking button directly above the `OPEN MAPS` / `CHECK-IN & PHOTO` row.
5. Tap `BOOK NOW`.
6. Return to app from provider handoff.
- **Expected Result / Action:**
1. Booking intent is created for that activity.
2. Status updates to `Redirected`.
3. Return outcome sheet appears on app foreground.
4. No crash or blocked navigation occurs.
- **If blocked:** If footer button shows `BOOKING UNAVAILABLE` instead of `BOOK NOW`, this activity is not valid for QA-4-01. Go back and open a different activity with a booking lane.
- [ ] Pass

### QA-4-02 Journeys Booking Intent
- **Objective:** Verify Journeys booking action creates intent with itinerary context.
- **Steps:**
1. Open `MainTabs -> Journeys`.
2. On any itinerary stop row, tap the booking ticket action.
3. Return to app from provider handoff.
- **Expected Result / Action:**
1. Booking intent is created with `itinerary_id` and `itinerary_item_id`.
2. Stop-row booking chip updates to `Redirected`.
3. Return outcome sheet appears.
- [ ] Pass

### QA-4-03 Outcome Save Path
- **Objective:** Verify successful outcome capture from return sheet.
- **Steps:**
1. Trigger booking from Details or Journeys.
2. Return to app and wait for outcome sheet.
3. Select `Booked`.
4. Enter optional values (`provider_confirmation_ref`, `total_minor`, `currency`).
5. Tap `Save`.
- **Expected Result / Action:**
1. Outcome persists successfully.
2. Status updates to `Booked`/confirmed state on the initiating surface.
3. Success notice appears.
4. Outcome sheet closes.
- [ ] Pass

---

## Acceptance Gate 2: Failure States Offer Retry or Fallback

### QA-4-04 Missing/Invalid Provider URL Failure
- **Objective:** Verify handoff failure path is clear and recoverable.
- **Steps:**
1. Use an activity/row with unavailable or invalid booking URL.
2. Tap booking action.
- **Expected Result / Action:**
1. Booking failure notice is shown.
2. State updates to `Failed`.
3. User can retry from the same surface.
- [ ] Pass

### QA-4-05 Retry Path
- **Objective:** Verify failed booking can be retried cleanly.
- **Steps:**
1. Complete QA-4-04 first.
2. Tap booking action again.
- **Expected Result / Action:**
1. New booking attempt starts (no stuck disabled state).
2. If URL is now valid, handoff opens and state becomes `Redirected`.
- [ ] Pass

### QA-4-06 Mark Abandoned Path
- **Objective:** Verify explicit abandonment flow.
- **Steps:**
1. Trigger booking and return to app.
2. In outcome sheet, tap `Mark Abandoned`.
- **Expected Result / Action:**
1. Intent status updates to `Abandoned`.
2. Sheet closes.
3. Booking chip/summary reflects abandoned state.
- [ ] Pass

### QA-4-07 Dismiss/Later Path
- **Objective:** Verify non-destructive deferral behavior.
- **Steps:**
1. Trigger booking and return to app.
2. In outcome sheet, tap `Later` (do not save outcome).
- **Expected Result / Action:**
1. Intent remains `Redirected` (not auto-abandoned).
2. User can capture outcome later.
- [ ] Pass

---

## Acceptance Gate 3: Funnel Query/Telemetry Readiness

### QA-4-08 Telemetry Contract Coverage
- **Objective:** Verify required booking events and payload fields are documented and testable.
- **Steps:**
1. Open `docs/sprint-4/telemetry-validation-notes.md`.
2. Verify all required events are listed:
   - `booking_intent_started`
   - `booking_provider_opened`
   - `booking_outcome_recorded`
   - `booking_outcome_failed`
3. Verify guest-mode + attribution fields are included.
- **Expected Result / Action:**
1. Event catalog is complete.
2. Required fields are explicit for each event.
3. Guest/local + commission fields are documented.
- [ ] Pass

### QA-4-09 Funnel Query Definitions
- **Objective:** Verify funnel SQL definitions are ready for auth-sync phase.
- **Steps:**
1. Open `docs/sprint-4/funnel-query-definitions.md`.
2. Confirm queries exist for:
   - intent volume
   - started->outcome conversion
   - booked conversion
   - provider-level performance
   - failure/abandon breakdown
- **Expected Result / Action:**
1. Query set supports conversion monitoring end-to-end.
2. Guest-mode note explains deferred remote-source timing.
- [ ] Pass

---

## End-of-Phase Code Review (Mandatory)
- [ ] Conduct full code review for UI/UX quality and design consistency.
- [ ] Identify and fix any bugs or missing cross-screen/service connections.
- [ ] Re-check accessibility labels and announcements for booking actions and outcome sheet interactions.

---

## Regression + Quality Gates
- [ ] `npx tsc --noEmit`
- [ ] `npm test -- --runInBand`
- [ ] `npm run policy:lint`
- [ ] `npm run sprint:end:check` (when Sprint 4 is close-ready)
