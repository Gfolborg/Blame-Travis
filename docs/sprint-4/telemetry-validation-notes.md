# Sprint 4 Telemetry Validation: Step-by-Step

## Preconditions
- If no deterministic bookable row exists, run `npm run qa:seed:booking-lane` before these tests.
- Run `npm run qa:cleanup:booking-lane` immediately after telemetry QA to remove QA-only booking lanes from active discovery.
- Optional dev-only hard cleanup: run `npm run qa:purge:booking-lane` to permanently remove seeded QA rows.

## Event Wiring Scope

| Event | Trigger Point | Required Fields |
|---|---|---|
| `booking_intent_started` | User taps booking CTA (Details or Journeys) | `activity_id`, `provider`, `surface`, `itinerary_id`, `itinerary_item_id`, `booking_intent_id` |
| `booking_provider_opened` | Provider handoff opens | `booking_intent_id`, `provider`, `surface` |
| `booking_outcome_recorded` | Outcome sheet save succeeds | `booking_intent_id`, `outcome_status`, `total_minor`, `currency` |
| `booking_outcome_failed` | Handoff/outcome fails or user marks abandoned | `booking_intent_id`, `error_code`, `surface` |

## Required Guest-Mode Attribution Fields
- `mode = guest_local`
- `auth_sync_required = true`
- `commission_partner_id`
- `commission_campaign_id`
- `commission_rate_bps`
- `commission_expected_minor`

---

## Telemetry QA Cases (Manual)

### TEL-4-01 Intent Started from Details
- **Steps:**
1. Open bookable activity in Details.
2. Tap `BOOK NOW`.
- **Expected Telemetry Action:**
1. One `booking_intent_started` event emitted.
2. Payload includes `surface=details`.
3. Payload includes `booking_intent_id`, `provider`, guest-mode + attribution fields.
- [ ] Pass

### TEL-4-02 Intent Started from Journeys
- **Steps:**
1. Open Journeys.
2. Tap booking action on an itinerary stop.
- **Expected Telemetry Action:**
1. One `booking_intent_started` event emitted.
2. Payload includes `surface=journeys`.
3. Payload includes `itinerary_id` and `itinerary_item_id`.
- [ ] Pass

### TEL-4-03 Provider Opened
- **Steps:**
1. Trigger booking from either surface with valid booking URL.
2. Confirm provider handoff opens.
- **Expected Telemetry Action:**
1. One `booking_provider_opened` event emitted.
2. `booking_intent_id` matches prior `booking_intent_started`.
- [ ] Pass

### TEL-4-04 Outcome Recorded
- **Steps:**
1. Return from provider handoff.
2. In outcome sheet, select status and tap `Save`.
- **Expected Telemetry Action:**
1. One `booking_outcome_recorded` event emitted.
2. Payload includes `outcome_status`, `total_minor`, `currency`.
3. `booking_intent_id` ties back to same intent chain.
- [ ] Pass

### TEL-4-05 Outcome Failed (Provider Open Failure)
- **Steps:**
1. Trigger booking with invalid/unopenable provider URL.
- **Expected Telemetry Action:**
1. One `booking_outcome_failed` event emitted.
2. Payload `error_code` indicates open failure path.
- [ ] Pass

### TEL-4-06 Outcome Failed (Abandoned)
- **Steps:**
1. Trigger booking and return to app.
2. In outcome sheet, tap `Mark Abandoned`.
- **Expected Telemetry Action:**
1. One `booking_outcome_failed` event emitted.
2. Payload contains `error_code=abandoned_by_user`.
- [ ] Pass

---

## Automated Evidence
- [x] `npx tsc --noEmit` PASS
- [x] `npm test -- --runInBand` PASS
- [x] `npm run policy:lint` PASS
