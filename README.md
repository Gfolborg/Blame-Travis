# Blame Travis - Product README

## Overview

**Blame Travis** is a things-to-do search travel app with personality.

Travelers tell Travis where they are going (or use near me), choose what they are in the mood for, and get ranked activities they can save into a day-by-day itinerary and book in-app.

Brand line:
**Travis Made Me Do It.**

## Product Direction

The app now centers on activity discovery and conversion, not just pre-assigned surprises.

Blame Travis must answer three questions quickly:
1. What can I do here?
2. What fits me right now?
3. What should I book or save first?

## Core Experience Loop

1. **Search**: destination, keyword, category, or near-me input.
2. **Refine**: fast filters for budget, duration, interest, rating, availability, group fit, and accessibility.
3. **Discover**: visual cards, map toggle, and social proof.
4. **Save/Curate**: user assigns activities directly into an itinerary day with an explicit itinerary target.
5. **Plan**: Travis assembles and explains the ranked day plan.
6. **Book**: user books in-app when supplier inventory supports it.
7. **Complete + Return**: reminders, stamps, and personalized follow-up suggestions.

## Explore Screen Blueprint

The default browse surface should include:
1. Search bar
2. Featured destinations
3. Category chips
4. Top Picks for [City]
5. Curated collections
6. Hidden gems/community picks
7. List-map toggle

## Search and Filter Rules

- MVP supports text search + category browsing first.
- Keep filters high-impact and mobile-fast.
- Limit users to 3 selections per filter group to reduce zero-result dead ends.
- Prioritize filters that convert:
  - price
  - duration
  - category
  - date/availability
  - rating
  - group type
  - accessibility

## Data and AI Architecture

### Discovery and Booking Data

- **POI discovery layer**: Google Places API first (optional Foursquare expansion).
- **Bookable activity layer**: Viator first, with future optional expansion to GetYourGuide/Amadeus.
- **Hybrid strategy**: broad discovery plus bookable depth in the same destination flow.
- **Affiliate/partnership mode**: partner-booking handoffs are allowed in MVP when clearly disclosed and attribution-tracked.
- **Affiliate dark-launch foundation**: affiliate data model + server action contract are implemented, but all affiliate UI surfaces stay off by default via feature flags until activation.
- **Current security mode**: discovery helper calls (autocomplete/geocode/reverse-geocode) are edge-first; temporary client fallback is allowed for development only. See `docs/release/discovery-fallback-handoff.md`.
- **Privileged edge-function guardrails**: scheduler/admin functions now require `x-edge-cron-secret` and image-generation writes require an authenticated caller that owns the target adventure.

### Personalization Stack

- **Phase 1**: rules-based ranking from onboarding preferences and simple behavior signals.
- **Phase 2**: LLM ranking/explanations for "Top picks for you" and itinerary assembly.
- **Phase 3**: collaborative filtering from saved/booked/completed behavior.

### Behavior Signals to Track

- searched destinations
- tapped/skipped categories
- saved activities
- detail-page dwell time
- bookings/completions

## Travis Role

Travis remains the host voice and recommendation narrator.

- Structured data APIs are the source of truth for logistics, availability, and location facts.
- LLM output is for framing, ranking explanation, tone, and itinerary storytelling.
- Travis copy is confident, adventurous, lightly sarcastic, and motivating.

## UX and Design Direction

- Keep the **Explorer's Map** visual system:
  - parchment backgrounds
  - ink-black text
  - vintage red accents
- Use a floating bottom tab dock with smooth motion; active-tab labels must remain fully readable (no truncation artifacts like `Expl...`).
- Active bottom-tab treatment should prioritize icon-first clarity with label support beneath the icon when expanded.
- Use visual-first activity cards with clear hero image, price, duration, rating, and save action.
- Avoid native `Alert.alert` product messaging; use in-app notice components.
- Prioritize Android-first smoothness and map/list performance.
- Map views must gracefully handle stops without coordinates (never crash; provide non-map fallback labeling).
- Returning to Journeys from bottom-tab navigation should refresh without flashing full-screen loading states.
- Legacy modal itinerary generation flow (`AdventureRequest` -> `AdventureAssignment` -> `AdventureReveal`) is retired; itinerary creation and review now route through `Journeys` and `Explore`.
- When multiple itineraries exist, add flows must prompt for target itinerary, then remember that choice for subsequent adds.
- Enforce a soft cap of 5 non-archived itineraries; only surface guidance when the user attempts to create a 6th itinerary.
- Passport v1 uses foreground auto-stamping only: when a traveler stays within roughly 500ft of an active-itinerary stop for about 120 seconds, the stop is stamped automatically (no manual stamp action required).
- Passport stamp art currently uses deterministic placeholder ink badges; final branded stamp assets should follow `docs/sprint-5/passport-stamp-art-direction.md`.
- Profile v1 prioritizes core controls only (account, notifications, permissions, privacy) and intentionally excludes Travis tone/default controls from the main profile surface.

## Monetization Direction

1. Booking commission (primary early model)
2. Featured placement for activity providers
3. Premium itinerary and advanced personalization tier
4. Optional subscription for offline + advanced filters

### Affiliate and Partnership UX Rules

- Clearly label monetized inventory (`Partner offer`/`Sponsored`) at point of interaction.
- Prioritize placement on Activity Details (primary CTA) and Itinerary stops (secondary CTA).
- Keep Explore feed discovery-first; use subtle partner badges instead of repeated hard-sell CTAs.
- Maintain relevance-first ranking with bounded sponsored influence.
- Track partner attribution at minimum for impression, click, handoff start, and handoff return.
- Treat affiliate options as a supplement to user intent (helpful next option), not as an interruption to discovery or planning.
- Keep affiliate UI dark until implemented and enabled: no partner surfaces should appear without active partner/offer configuration and feature flags.

### Affiliate QA Tooling (Dark Launch)

- Seed mock partner/offer/placement data: `npm run qa:seed:affiliate-foundation`
- Verify attribution queryability summary: `npm run qa:verify:affiliate-foundation`
- Cleanup (disable seeded rows): `npm run qa:cleanup:affiliate-foundation`
- Purge QA rows: `npm run qa:purge:affiliate-foundation`
- Runbook: `docs/sprint-4/affiliate-qa-runbook.md`

### Planned Expansion Path (Not Live Yet)

1. Activity partner handoff (Details-first; optional on Journeys).
2. Adjacent travel supplements for hotels/cars on high-intent surfaces.
3. Flights supplement lane after post-launch reliability/trust gates.

## Out of Scope (for now)

- Building a generic OTA for flights/hotels before activity discovery quality is strong
- Overloading MVP with long-tail filters
- Shipping AI-only planning without grounded place/activity inventory

## One-Sentence Summary

**Blame Travis helps travelers find, rank, save, and book the best things to do with a fast search UX, grounded travel data, and Travis-led personality.**
