# Affiliate Contract v1

Last updated: 2026-04-30
Owner: Product + Engineering
Status: Draft for implementation

## 1) Decision Record

Decision: Approve affiliate and partnership support as MVP monetization infrastructure, implemented in a relevance-first and disclosure-first model.

Classification:
- MVP-critical infrastructure: yes (tracking + disclosure + safe handoff)
- Growth optimization: yes (sponsored boost tuning and payout reconciliation automation)

Primary success metrics:
- Affiliate handoff CTR by surface
- Handoff start to return rate
- Return to booking report rate
- Commission confirmed per partner and destination

## 2) Scope

In scope (v1):
- Affiliate booking partner handoff links
- Sponsored placement labels and placement rules
- Attribution event capture for impression, click, handoff, return, booking report, commission confirmation
- Partner and offer catalog with validity windows
- Copy-variant tracking fields for CTA/disclosure performance analysis
- Release gating so affiliate UI remains hidden until partner onboarding and feature activation are complete

Out of scope (v1):
- Real-time bid auctions
- Multi-touch weighted attribution
- Automated payout disbursement

## 3) UX Contract

Primary placement:
- Activity Details: primary affiliate CTA (`Book with Partner`)

Secondary placement:
- Itinerary stop card/action row: secondary affiliate CTA

Browse placement:
- Explore cards: partner badge only by default (`Partner offer` or `Sponsored`)

Disclosure rules:
- Monetized inventory must show a visible disclosure label at point of interaction.
- Disclosure cannot rely on color alone; icon or text indicator is required.
- Sponsored placement cannot displace all top relevance results in a viewport.

Ranking guardrail:
- Relevance-first ranking remains default.
- Sponsored boost cap: maximum one boost tier above baseline relevance bucket.
- At least 3 of top 5 results must remain organic relevance results when results are available.

## 4) Attribution Rules

Default model:
- Last eligible click wins attribution.
- Attribution window: 7 days from click.
- Commission confirmation window: 30 days from attributed click.

Dedupe rules:
- Repeated click events for same `user_id or guest_id + offer_id + activity_id + surface` within 10 minutes are marked `deduped=true`.
- Only non-deduped click can become authoritative attribution candidate.

Precedence:
- Details click outranks Explore click if both occur in the same session before handoff.
- Most recent eligible click overrides earlier clicks.

## 5) Data Contract (Supabase)

## 5.1 Tables

`affiliate_partners`
- `id uuid pk`
- `slug text unique not null`
- `name text not null`
- `status text not null` (`active`, `paused`, `retired`)
- `disclosure_label text not null default 'Partner offer'`
- `default_commission_model text not null` (`cpa`, `rev_share`, `flat`)
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`affiliate_offers`
- `id uuid pk`
- `partner_id uuid not null references affiliate_partners(id)`
- `provider_ref text not null`
- `title text not null`
- `status text not null` (`active`, `paused`, `expired`)
- `commission_model text not null` (`cpa`, `rev_share`, `flat`)
- `commission_value numeric(10,4) null`
- `currency_code text null`
- `destination_scope text[] not null default '{}'`
- `category_scope text[] not null default '{}'`
- `tracking_template text not null`
- `valid_from timestamptz not null`
- `valid_to timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`affiliate_placements`
- `id uuid pk`
- `surface text not null` (`explore_card`, `details_primary_cta`, `journeys_stop_cta`)
- `placement_key text unique not null`
- `disclosure_required boolean not null default true`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`

`affiliate_attributions`
- `id uuid pk`
- `user_id uuid null`
- `guest_id text null`
- `session_id text not null`
- `activity_id uuid not null`
- `offer_id uuid not null references affiliate_offers(id)`
- `partner_id uuid not null references affiliate_partners(id)`
- `placement_id uuid not null references affiliate_placements(id)`
- `attribution_status text not null` (`candidate`, `attributed`, `expired`, `superseded`)
- `click_ts timestamptz not null`
- `expires_at timestamptz not null`
- `deduped boolean not null default false`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

`affiliate_payout_events`
- `id uuid pk`
- `partner_id uuid not null references affiliate_partners(id)`
- `offer_id uuid null references affiliate_offers(id)`
- `attribution_id uuid null references affiliate_attributions(id)`
- `external_booking_ref text null`
- `payout_status text not null` (`reported`, `confirmed`, `rejected`, `reversed`)
- `commission_amount numeric(12,2) null`
- `currency_code text null`
- `event_ts timestamptz not null`
- `raw_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

## 5.2 Indexes

Required read-path indexes:
- `affiliate_offers(partner_id, status, valid_from desc)`
- `affiliate_offers(status, valid_to)`
- `affiliate_attributions(user_id, click_ts desc)`
- `affiliate_attributions(guest_id, click_ts desc)`
- `affiliate_attributions(partner_id, placement_id, click_ts desc)`
- `affiliate_payout_events(partner_id, event_ts desc)`
- `affiliate_payout_events(payout_status, event_ts desc)`

## 5.3 RLS Model

- `affiliate_partners`, `affiliate_offers`, `affiliate_placements`: read-only to authenticated users; writes service-role/admin only.
- `affiliate_attributions`: user can read own rows (`auth.uid() = user_id`); guest rows are app-internal; write via edge function only.
- `affiliate_payout_events`: service-role/admin only by default; no direct client writes.

## 6) Event Contract

Canonical events:
- `affiliate_impression`
- `affiliate_click`
- `affiliate_handoff_started`
- `affiliate_handoff_returned`
- `affiliate_booking_reported`
- `affiliate_commission_confirmed`

Required payload keys:
- `event_name`
- `event_ts`
- `session_id`
- `user_id` or `guest_id`
- `activity_id`
- `partner_id`
- `offer_id`
- `surface`
- `placement_key`
- `destination_city`
- `deduped` (for click events)
- `copy_variant`
- `partner_brand`
- `disclosure_wording`

Example payload:

```json
{
  "event_name": "affiliate_click",
  "event_ts": "2026-04-30T20:15:41.000Z",
  "session_id": "7f0d2f65-f4b3-4d1b-8d11-c31395f9c1a8",
  "guest_id": "guest_8f2391",
  "activity_id": "a0a9ac75-9f7e-41ff-ac2a-a11a2fc18f7d",
  "partner_id": "44f6bc3d-e1dc-4f04-9f57-e99c29f72a1f",
  "offer_id": "1b9c8d66-2944-4480-8f2f-a9f6d77f3e8c",
  "surface": "details",
  "placement_key": "details_primary_cta",
  "copy_variant": "details_brand_cta_v1",
  "partner_brand": "Expedia",
  "disclosure_wording": "Partner offer",
  "destination_city": "Austin",
  "deduped": false
}
```

Validation constraints:
- Max payload size: 4 KB
- Unknown enum values rejected
- Missing partner, offer, or placement ids rejected for affiliate events
- Missing `copy_variant`, `placement_key`, or `disclosure_wording` rejected for affiliate events

## 7) Security and Compliance

- No partner API secrets in mobile client.
- Link construction with sensitive signatures must happen server-side.
- Edge endpoints validate partner/offer active status before returning handoff URLs.
- All sponsored inventory must render with disclosure labels.
- Privacy policy must disclose outbound partner handoff and attribution telemetry.

## 8) Reporting Contract

Required analytics views:
- CTR by `partner_id + placement_key + city`
- Handoff start to returned ratio by partner
- Returned to booking reported ratio by surface
- Confirmed commission by partner and month
- Disclosure coverage rate (`impressions with disclosure / total monetized impressions`)

## 9) Operational Playbook

Partner onboarding checklist:
1. Add partner row and offer rows.
2. Validate tracking template and destination/category scopes.
3. Configure disclosure label and placement enablement.
4. Run sandbox click -> handoff -> return QA.
5. Enable via feature flag per surface.
6. Validate copy payload fields (`copy_variant`, `partner_brand`, `disclosure_wording`) before partner activation.

Kill switches:
- Global: `affiliate_enabled`
- Per surface: `affiliate_details_enabled`, `affiliate_journeys_enabled`, `affiliate_explore_badge_enabled`
- Per partner: set `affiliate_partners.status = 'paused'`

Rollback:
- Disable feature flags.
- Pause affected partner.
- Preserve attribution and payout event history for reconciliation.

## 10) Acceptance Gates (v1 Completion)

- Disclosure labels verified on all monetized placements.
- Attribution events queryable by partner, offer, and surface.
- Attribution events queryable by partner, offer, surface, and copy variant.
- Dedupe and attribution-window rules validated with test fixtures.
- No client-exposed partner secrets.
- Policy and phase checks pass (`npm run policy:lint`, `npm run sprint:end:check`).
