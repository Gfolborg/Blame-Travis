# ADR-001: Canonical Domain Contracts for Blame Travis

**Date:** 2026-04-19  
**Status:** Accepted  
**Owners:** Product + Mobile + Data

## Context
Blame Travis is moving from "pre-assigned adventure drops" to an activity-discovery product loop:
Explore -> Refine -> Compare -> Inspect -> Save -> Plan -> Book -> Return.

The existing code and database are centered on `adventures` and `adventure_days`. That model does not cleanly support:
1. Search sessions and filter-state analytics.
2. Multi-source activity ingestion (POI + bookable).
3. Save-first behavior before itinerary creation.
4. Booking intent/outcome tracking.

This ADR defines the single canonical contract set for app, services, analytics, and Supabase.

## Decision
Adopt the contracts below as the only valid v1 domain model for travel activity discovery.

## Contract Versioning
- `contract_version`: `travel-v1`
- Breaking changes require:
1. New version string.
2. Backward compatibility adapter or migration plan.
3. Update to `README.md`, `AGENTS.md`, `gemini.md`, `phases.md`.

## Shared Field Rules
- IDs: `uuid` in DB, opaque `string` in app APIs.
- Time: RFC3339 UTC (`2026-04-19T18:05:00Z`).
- Currency: ISO 4217 code + integer minor units.
- Coordinates: decimal degrees, WGS84.
- Provider facts are source-of-truth for logistics fields.
- LLM-generated text cannot overwrite factual logistics fields.

## Canonical Types (TypeScript)
```ts
export type ActivitySource = "google_places" | "foursquare" | "viator" | "manual";
export type ActivityStatus = "active" | "hidden" | "deprecated";
export type ActivityPriceTier = "free" | "budget" | "mid" | "premium" | "unknown";
export type BookingIntentStatus = "initiated" | "provider_redirected" | "abandoned" | "confirmed" | "failed";
export type BookingOutcomeStatus = "booked" | "cancelled" | "refunded" | "attended" | "no_show";

export interface Activity {
  id: string;
  canonical_key: string;
  title: string;
  summary: string | null;
  categories: string[];
  tags: string[];
  source_priority: ActivitySource;
  status: ActivityStatus;
  location: {
    city: string;
    region: string | null;
    country_code: string;
    address_line: string | null;
    lat: number;
    lng: number;
    timezone: string;
  };
  pricing: {
    tier: ActivityPriceTier;
    from_minor: number | null;
    to_minor: number | null;
    currency: string | null;
    is_free: boolean;
  };
  duration_minutes_min: number | null;
  duration_minutes_max: number | null;
  rating_average: number | null;
  rating_count: number | null;
  review_provider: ActivitySource | null;
  image_url: string | null;
  booking_supported: boolean;
  booking_deep_link: string | null;
  accessibility_tags: string[];
  family_friendly: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  destination: string | null;
  near_me: boolean;
  radius_km: number | null;
  categories: string[];
  price_tiers: ActivityPriceTier[];
  duration_buckets: Array<"lt60" | "60_180" | "181_360" | "gt360">;
  min_rating: number | null;
  date_start: string | null;
  date_end: string | null;
  group_type: "solo" | "couple" | "family" | "friends" | null;
  accessibility: string[];
  max_per_filter_group: 3;
}

export interface SavedActivity {
  id: string;
  user_id: string;
  activity_id: string;
  source_context: "list" | "map" | "details" | "collection";
  search_session_id: string | null;
  saved_at: string;
  notes: string | null;
}

export interface Itinerary {
  id: string;
  user_id: string;
  title: string;
  destination_city: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "ready" | "in_progress" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export interface BookingIntent {
  id: string;
  user_id: string;
  itinerary_id: string | null;
  itinerary_item_id: string | null;
  activity_id: string;
  provider: ActivitySource;
  status: BookingIntentStatus;
  provider_url: string | null;
  started_at: string;
  last_transition_at: string;
}

export interface BookingOutcome {
  id: string;
  booking_intent_id: string;
  user_id: string;
  status: BookingOutcomeStatus;
  provider_confirmation_ref: string | null;
  booked_for_start_at: string | null;
  total_minor: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}
```

## Hard Invariants
1. `Activity.canonical_key` is globally unique.
2. `SavedActivity` uniqueness: `(user_id, activity_id)`.
3. `SearchFilters.max_per_filter_group` is fixed to `3` for MVP.
4. `BookingOutcome` cannot exist without a `BookingIntent`.
5. `Itinerary` items must reference valid `activity_id`.

## API Envelopes
```ts
export interface ApiSuccess<T> {
  ok: true;
  contract_version: "travel-v1";
  data: T;
  meta: { request_id: string; generated_at: string };
}

export interface ApiFailure {
  ok: false;
  contract_version: "travel-v1";
  error: { code: string; message: string; retryable: boolean; provider?: string };
  meta: { request_id: string; generated_at: string };
}
```

## Legacy Mapping Rules
| Legacy Field | New Destination | Rule |
|---|---|---|
| `adventures.title` | `itineraries.title` | Copy verbatim |
| `adventures.user_id` | `itineraries.user_id` | Copy verbatim |
| `adventure_days.itinerary_json[*]` | `itinerary_items` + `activities` | Normalize each stop |
| `adventures.why_travis_picked_this` | item `narrative_why` | Move to itinerary-item narrative |
| `adventures.status` | `itineraries.status` | Map by conversion table in migration doc |

## Acceptance Tests for This ADR
1. All API edge handlers return `contract_version`.
2. No new table or API contract uses `adventure_*` nomenclature for discovery/booking paths.
3. Type generation references this contract set as v1 source.
