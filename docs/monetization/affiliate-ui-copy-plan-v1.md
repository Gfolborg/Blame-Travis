# Affiliate UI Copy Plan v1

Last updated: 2026-04-30
Owner: Product + Design + Engineering
Scope status: Approved for implementation

## 1) Locked Decisions

- Vertical scope: activity booking only for v1.
- Launch scope: Details screen first.
- CTA style: brand-forward direct CTA.
- Default disclosure label: `Partner offer`.
- Disclosure placement: inline near primary booking CTA.
- Future planning: include OTA appendix (flights/hotels/cars) without changing v1 implementation scope.
- Visibility gate: no affiliate/partner copy appears in live UI until implementation is complete, active partner data exists, and release flags are enabled.

## 2) Copy Contract (Details-First)

Primary CTA pattern:
- With known brand: `Book on {PartnerName}`
- Without known brand: `Book with Partner`

Disclosure:
- Default label: `Partner offer`
- Placement: directly below or adjacent to booking CTA in the action bar zone.

Supporting helper line (optional, non-CTA):
- `Travis: 'Solid pick. Booking opens with our partner.'`

Tone rules:
- CTA labels remain direct and non-jokey.
- Travis personality belongs in helper/supporting text only.
- No urgency claims unless provider-sourced facts are verified.

## 3) Details State Matrix

| State | CTA Text | Disclosure | Supporting Copy | A11y Announcement |
| --- | --- | --- | --- | --- |
| Ready (brand known) | `Book on Expedia` | `Partner offer` | Optional Travis helper line | `Booking opens with partner: Expedia` |
| Ready (brand unknown) | `Book with Partner` | `Partner offer` | Optional Travis helper line | `Booking opens with partner site` |
| Opening handoff | `Opening...` | `Partner offer` | `Travis: 'Hang tight while we open the partner page.'` | `Opening partner booking page` |
| Missing link / disabled | `Booking unavailable` | Hidden when no offer | `Try another activity or check back soon.` | `Booking unavailable for this activity` |
| Handoff failed | `Try partner again` | `Partner offer` | `Could not connect to partner right now.` | `Could not open partner booking page` |
| Returned from partner | `Booked status saved` | `Partner offer` (if offer still active) | `Your booking outcome can be updated below.` | `Returned from partner booking page` |

## 4) Event + Variant Contract

Required event fields for affiliate events:
- `copy_variant`
- `partner_brand`
- `disclosure_wording`
- `placement_key`

Default values for v1:
- `copy_variant`: `details_brand_cta_v1`
- `disclosure_wording`: `Partner offer`
- `placement_key`: `details_primary_cta`

Fallback rules:
- If partner brand is unknown, set `partner_brand = null` and use fallback CTA text.
- Events must still fire with the same `copy_variant` and placement identifiers.

## 5) Launch and QA Gates

Implementation-ready acceptance checks:
1. CTA and disclosure render in all Details monetized states.
2. Screen reader output matches matrix announcements.
3. Affiliate telemetry includes required copy fields on click/handoff/return events.
4. Disabled/unavailable states avoid dead-end UX and provide recovery copy.
5. Policy checks pass (`npm run policy:lint`, `npm run sprint:end:check`).

## 6) Future Appendix (Non-v1 Execution)

### 6.1 OTA Extension Patterns

When flights/hotels/cars are enabled in a future phase:
- Flights CTA pattern: `See flights on {PartnerName}`
- Hotels CTA pattern: `See hotels on {PartnerName}`
- Cars CTA pattern: `See cars on {PartnerName}`
- Disclosure remains inline and defaults to `Partner offer`.

### 6.2 Partner Expansion Rules

- New partners should plug into the same CTA/disclosure schema and event fields.
- No new copy system should be introduced per partner; only brand token and approved legal wording may vary.
- Partner-specific legal qualifiers can be appended in metadata, not as alternate CTA frameworks.
