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
4. **Save**: user favorites activities into an itinerary draft.
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
- Use visual-first activity cards with clear hero image, price, duration, rating, and save action.
- Avoid native `Alert.alert` product messaging; use in-app notice components.
- Prioritize Android-first smoothness and map/list performance.

## Monetization Direction

1. Booking commission (primary early model)
2. Featured placement for activity providers
3. Premium itinerary and advanced personalization tier
4. Optional subscription for offline + advanced filters

## Out of Scope (for now)

- Building a generic OTA for flights/hotels before activity discovery quality is strong
- Overloading MVP with long-tail filters
- Shipping AI-only planning without grounded place/activity inventory

## One-Sentence Summary

**Blame Travis helps travelers find, rank, save, and book the best things to do with a fast search UX, grounded travel data, and Travis-led personality.**
