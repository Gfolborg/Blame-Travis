# Building a "Things to Do" Search Travel App

## Executive Summary

Building a compelling activity discovery feature for a travel app requires three converging elements: a solid data layer (the right APIs), a smart search and filtering UX, and a personalization engine that learns user preferences over time. Apps that get this right — think TripAdvisor, Airbnb Experiences, and GetYourGuide — do so by marrying rich third-party inventory with intuitive interfaces and AI-driven recommendations. This guide covers the architecture, API choices, UX patterns, personalization strategies, and monetization approaches needed to build this feature from scratch as a solo founder or small team.

***

## The Core Problem to Solve

Discovery is fragmented. Travelers currently toggle between Google, TripAdvisor, Reddit, and Instagram just to figure out what to do in a city. The opportunity is to consolidate that research into a single, trusted surface inside your app. A great "things to do" feature answers three traveler questions fast:[^1]

1. **What's available?** — Surfacing a broad, accurate inventory of activities for a destination
2. **What fits me?** — Filtering by interest, budget, group size, and time
3. **What do others like me recommend?** — Social proof and personalized ranking

***

## Step 1: Choose Your Data Source (APIs)

This is the most foundational decision. You have two primary approaches:

### Activity & Experience APIs (Booking-Ready Inventory)

These APIs give you real activities with live availability and bookable tickets — not just Points of Interest (POIs):

| API | Coverage | Key Strength | Access Model |
|-----|----------|--------------|--------------|
| **Viator API** | 300,000+ activities globally | Real-time availability + booking | Partner program |
| **GetYourGuide API** | ~33,000 activities, 2,500+ destinations | Links related activities together (e.g., cruise → Empire State) | Partners only[^2] |
| **Klook API** | Asia-Pacific strong | Mobile vouchers, instant booking | Partner program |
| **Tiqets API** | Museums, theme parks, attractions | Ticket booking specialist | Direct integration |
| **Amadeus Activities API** | 300,000+ tours & activities | Part of broader flight/hotel suite | Developer API[^3] |

For a solo founder just getting started, **Viator** (owned by TripAdvisor) is the most accessible with flexible partner tiers and a broad global catalog. **Amadeus** is the better long-term choice if you plan to add flights and hotels, since it's a full travel suite under one API key.[^4][^3]

### Points of Interest (POI) APIs (Discovery Without Booking)

These are useful for the "explore" layer — showing what exists even if it's not directly bookable:

| API | POI Database Size | Best For |
|-----|-------------------|----------|
| **Google Places API (New)** | Massive global | Text search, autocomplete, photos, reviews[^5] |
| **Foursquare Places API** | 100M+ POIs | Hyper-specific category filters, global coverage[^6] |
| **Yelp Fusion API** | Strong US/Canada | Restaurant and activity reviews |
| **OpenStreetMap** | Open-source | Offline maps, free at scale |

A proven hybrid approach: use **Google Places** or **Foursquare** for the discovery/browse layer (what's near me, what's in this city), then surface **Viator or GetYourGuide** results for the same destination when users are ready to book. This gives you broad coverage without paying booking API fees for every casual browse.[^7]

***

## Step 2: Build the Search & Filter Architecture

### Search Input Patterns

Modern travel apps support multiple search modalities:[^8]

- **Text/keyword search** — "cooking class in Lisbon," "sunset hike near Sedona"
- **Category browsing** — Outdoor / Culture / Food & Drink / Nightlife / Family
- **AI/NLP natural language** — "Plan a 3-day trip to Tokyo under $500" processed by an LLM that generates an itinerary with embedded activity suggestions[^9][^10]
- **Voice search** — Siri/Alexa-style queries, increasingly expected by users[^8]
- **"Near me" / geolocation** — Pulling activities within the user's current radius automatically[^11]

For an MVP, start with text search + category browsing. Add AI/NLP in a second sprint once the inventory layer is stable.

### Filtering That Actually Converts

The best activity search interfaces let users narrow without overwhelming them. Proven filters:[^12]

- **Price range** (free, budget, mid-range, splurge)
- **Duration** (under 1 hour, half-day, full-day)
- **Category / interest type** (adventure, cultural, foodie, family-friendly, romantic)
- **Date/availability** (especially important to sync with bookable APIs)
- **Ratings** (4+ stars only, highly reviewed)
- **Group size** (solo, couple, family, group)
- **Accessibility** (wheelchair accessible, kid-friendly)

A key UX insight: limit users to a maximum of 3 selections per filter category to avoid producing zero-result dead ends. Use tabs or chips rather than long dropdowns to keep selection fast on mobile.[^12]

### Search Results Page Design

Visual-first cards perform better for activity discovery than text lists. Each activity card should include:[^10]

- Hero image (use the API's provided photos or pull from Google Places Photos)
- Activity name + one-line description
- Duration + price
- Rating with review count
- Quick "Save/Favorite" button that adds to their trip plan
- Booking CTA or "See Details" deeplink

***

## Step 3: Personalization & AI Recommendations

This is where the feature goes from "useful" to "sticky."

### Behavioral Signals to Track

From the moment a user opens your app, collect implicit preference signals:[^13]

- Destinations searched
- Categories tapped vs. skipped
- Activities saved/favorited
- Time spent viewing an activity detail page
- Past bookings or completed trips

### Recommendation Engine Options

| Approach | Complexity | Best For |
|----------|------------|---------|
| **Rule-based filtering** | Low | MVPs — "Users who liked X also liked Y" |
| **Collaborative filtering** | Medium | Matching behavior patterns across similar user profiles[^9] |
| **LLM-powered suggestions** | Medium-High | Conversational itinerary generation — "Plan my 4 days in Bali"[^10][^13] |
| **Multi-agent AI (LangGraph)** | High | Complex multi-city trip planning with real-time web data[^14] |

For a solo founder using TypeScript/Expo (your stack), the most practical path is:
1. **Phase 1**: Rule-based + category preferences collected at onboarding
2. **Phase 2**: Integrate an LLM (Claude, GPT-4o, or Gemini via OpenRouter) with a structured prompt that takes the user's destination + stated interests and returns a ranked activity list
3. **Phase 3**: Build a lightweight recommendation layer using collaborative filtering on your Supabase user behavior data

Research shows AI-driven itinerary systems can achieve 92.3% personalization accuracy and 94.2% user satisfaction versus manual planning flows.[^9]

### Onboarding Preference Collection

Don't wait for behavioral data. Ask users 3–5 quick questions on first launch:
- What kind of traveler are you? (Adventurer / Culture Lover / Foodie / Relaxer)
- Who do you usually travel with? (Solo / Couple / Family / Friends)
- What's your typical activity budget per day?

These answers seed your recommendation engine immediately and reduce the cold-start problem.

***

## Step 4: UX Flow — The Explore Screen

A high-performing activity discovery screen typically has these layers:[^15][^1]

1. **Search bar** at top with NLP-enabled input
2. **Featured Destinations** — curated cards for trending or seasonal spots
3. **Category chips** — horizontal scrollable filter row (Outdoor, Food, Culture, etc.)
4. **"Top Picks for [City]"** — AI-ranked results seeded by user preferences
5. **Curated Collections** — editorially created lists ("Best sunset spots in Santorini", "Family-friendly Bangkok")
6. **Hidden Gems / Community Picks** — UGC-powered section for authenticity[^15]
7. **Map View toggle** — let users switch between list and map layout

The Itinerary Builder should allow users to favorite activities into a trip plan, which then auto-generates a day-by-day schedule. Booking should happen inline — not redirect to an external site — to prevent conversion drop-off.[^16][^9]

***

## Step 5: Technical Stack Recommendations

Given your existing stack (Expo, Supabase, Vercel, TypeScript), here's a practical architecture:

| Layer | Recommended Tool |
|-------|-----------------|
| Activity data | Viator API + Google Places API |
| Maps & geolocation | Google Maps SDK / Mapbox |
| Search indexing | Supabase full-text search or Algolia |
| AI recommendations | OpenRouter (Claude/Gemini) with structured prompts |
| Itinerary storage | Supabase (user trip plans, saved activities) |
| Push notifications | Expo Push Notifications for trip reminders |
| Offline access | React Native AsyncStorage for saved itineraries |

Ensure your app handles real-time data updates from activity APIs, especially for availability and pricing, which can change frequently.[^17]

***

## Step 6: Monetization

A "things to do" feature has natural revenue paths:[^18][^19]

- **Commission per booking** (10–25% of booking value) — the dominant model used by TripAdvisor and GetYourGuide. Viator pays affiliate commissions for bookings driven through your app.[^4]
- **Featured placement fees** — charge local activity providers for premium placement in search results
- **Freemium AI planning** — offer basic activity search free, charge for AI-generated full itineraries
- **In-app subscription** — unlock advanced filters, offline access, and personalized trip plans for a monthly fee

For a bootstrapped solo product, start with the commission affiliate model (zero upfront cost, revenue tied to user activity) and layer in subscriptions once you have retention data.

***

## Key Pitfalls to Avoid

- **Building search before fixing data quality** — Garbage-in means bad recommendations. Curate your initial activity catalog for a few destination niches before going wide.
- **Too many filters at launch** — Ship with 3–4 core filters, not 20. You can always add; you can't take away without friction.
- **Ignoring offline** — Travelers are often in areas with poor connectivity. Cache itineraries and activity details locally.[^20]
- **Deep-linking to external booking pages** — Every redirect is a conversion killer. Use in-app WebViews or direct API booking to keep users in your app.[^9]
- **Skipping social proof** — Ratings and reviews are table stakes. If your API doesn't return them, augment with Google Places reviews via the Places Details endpoint.[^5]

***

## Conclusion

The winning formula for a travel activity search feature combines: (1) a bookable-inventory API like Viator layered on top of a POI API like Google Places, (2) a visual-first search/filter UX with smart category chips and a map toggle, (3) an AI recommendation engine that learns from user behavior and answers natural-language queries, and (4) a monetization model tied to booking commissions. The MVP path — activity search + category filters + save-to-trip — can be built in a focused sprint, then layered with AI personalization and in-app booking as the product matures.

---
Here's a comprehensive guide on building the "things to do" feature for your travel app — it covers everything from API selection to monetization.

The report walks through 6 key steps:

API Strategy — The best approach is a hybrid: use Viator or GetYourGuide for real, bookable activities (300,000+ globally), layered on top of Google Places or Foursquare for broader POI discovery. This gives you both depth and breadth.

Search & Filters — Support text search, category browsing, geolocation ("near me"), and eventually NLP/AI input. Limit filter selections to 3 per category to avoid zero-result dead ends.

AI Personalization — Collect preference signals at onboarding (travel style, budget, group type), then use an LLM via OpenRouter (Claude/Gemini) to generate ranked activity suggestions. AI-driven itinerary systems have shown 92.3% personalization accuracy in research.

Explore Screen UX — Visual-first cards with hero images, category chips, curated collections, and a map toggle perform best. Critically — keep booking in-app, not redirecting to external sites, to prevent conversion drop-off.

Stack fit for you — Given you're on Expo/Supabase/TypeScript, Viator + Google Places for data, Algolia or Supabase full-text for search, and OpenRouter for AI recs is a clean path forward.

Monetization — Start with affiliate commissions from Viator (10–25% per booking, zero upfront cost), then layer in a subscription tier for premium AI itinerary planning once you have retention data.

## References

1. [From Idea to Reality: Tourism App Design Step by Step - YouTube](https://www.youtube.com/watch?v=na5ADb0fXr0) - Turn your tourism app idea into reality! In this video, we guide you through designing a functional ...

2. [Travel APIs: Types, Providers and Integration - AltexSoft](https://www.altexsoft.com/blog/travel-and-booking-apis-for-online-travel-and-tourism-service-providers/) - Doing travel API integration, consider these APIs from GDS providers, OTAs, and local data owners fo...

3. [25 Best Travel APIs Top List and Selection Guide - Django Stars](https://djangostars.com/blog/25-best-travel-apis/) - Overview of the 25 best travel APIs, highlighting the most proven data sources for flights or hotel ...

4. [Best Travel APIs: Types, Providers, and Tips for Selection - Cleveroad](https://www.cleveroad.com/blog/travel-apis/) - Viator API – Provides access to various tours, activities, and excursions, with real-time availabili...

5. [Overview | Places API - Google for Developers](https://developers.google.com/maps/documentation/places/web-service/overview) - The Places API is a service that accepts HTTP requests for location data through a variety of method...

6. [Foursquare vs. Google Places API vs. Yelp Comparison - SourceForge](https://sourceforge.net/software/compare/Foursquare-vs-Google-Places-API-vs-Yelp/) - Compare Foursquare vs. Google Places API vs. Yelp using this comparison chart. Compare price, featur...

7. [17 Top Google Places API Alternatives for Points of Interest Data | Blog](https://traveltime.com/blog/google-places-api-alternatives-points-of-interest-data) - The Foursquare Places API provides location information about venues, users, photos and check-ins. J...

8. [Emerging Travel App Trends in 2025 You Need to Know | CodeDTX](https://codedtx.com/blog/emerging-travel-app-trends-in-2025-you-need-to-know) - 7 Travel App Trends in 2025 · 1. Personalization and AI Integration · 2. Augmented and Virtual Reali...

9. [How to build a travel planner app: A complete guide for 2026](https://coaxsoft.com/blog/how-to-build-a-travel-planner-app) - Building or choosing a travel planning app? Read this guide on travel planning software features, st...

10. [How to Build Smart AI Trip Planner App: Complete Guide](https://codiant.ai/blog/smart-ai-trip-planner-app-development-guide/) - Learn how to build a smart AI trip planner app. Explore features, pricing models, & step-by-step dev...

11. [How to Develop a Travel App for Travel and Tourism Industry - Anadea](https://anadea.info/blog/app-for-travel-and-tourism/) - Find a travel buddy. Users connect with each other to travel together, plan and discuss their future...

12. [Helping travelers save time and effort by providing effective ...](https://medium.muz.li/travel-plan-details-screen-2735b9eddeae) - Users can select travel plan as per their budget, time they can allocate, Ratings, most followed pla...

13. [5 Steps to Integrate an AI Travel Recommendation Engine - Intuz](https://www.intuz.com/blog/how-to-integrate-ai-recommendation-engine-into-travel-platform) - In this blog, you'll learn how to integrate an AI-powered trip search and recommendation engine into...

14. [AI-Powered Travel Recommendations with LangGraph & LLMs](https://www.linkedin.com/posts/2502tejaswi_ai-generativeai-llm-activity-7426991863557140480-CIJ8) - How LLMs Improve Travel Recommendation Engines · Integrating LLM Explanations into Recommendation Sy...

15. [The Must-Have Features for a Successful Travel App in 2025](https://flutterdevs.com/blog/the-must-have-features-for-a-successful-travel-app-in-2025/) - 1. AI-Powered Personalization and Itinerary Builder · 2. Real-Time Booking & Dynamic Search · 3. Mul...

16. [How to Create a Travel App: No-Code App Creation](https://shoutem.com/apps/travel/) - Create a travel or tourism app using Shoutem's pre-built templates. Engage clients, attract new visi...

17. [Customizing Your Travel Booking System with Tours and Activities API](https://technosoftwares.com/blog/customizing-your-travel-booking-system-with-tours-and-activities-api/) - The Tours and Activities API serves as a bridge between travel service providers and customers, faci...

18. [Top 10 Travel App Monetization Strategies You Should Consider](http://www.naijanetwork.com/discussion/28910/top-10-travel-app-monetization-strategies-you-should-consider) - For travel apps that focus on booking flights, hotels, tours, or car rentals, a commission-based mod...

19. [How Do Booking-Based and Commission Pricing Work in Travel ...](https://www.getmonetizely.com/articles/how-do-booking-based-and-commission-pricing-work-in-travel-and-tourism-saas) - Commission-based pricing models take a percentage of the transaction value rather than charging per ...

20. [Most successful travel app ideas for your consideration - iteo](https://iteo.com/blog/post/most-successful-travel-app-ideas-for-your-consideration/) - 25 examples of mobile applications that are conquering the tourism industry. Various ideas to fill t...

