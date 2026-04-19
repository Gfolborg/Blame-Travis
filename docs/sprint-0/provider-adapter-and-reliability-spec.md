# Provider Adapter and Reliability Specification (travel-v1)

**Date:** 2026-04-19  
**Applies To:** `discover-places`, `place-details`, provider HTTP clients

## Objectives
1. Isolate provider-specific payloads behind stable app contracts.
2. Ensure deterministic failure behavior and retries.
3. Prevent provider outages from breaking core UX.

## Adapter Interfaces
```ts
export interface ActivitySearchRequest {
  request_id: string;
  query: string | null;
  filters: SearchFilters;
  location_hint: { lat: number; lng: number; city?: string | null } | null;
  pagination: { limit: number; cursor?: string | null };
}

export interface ActivitySearchResult {
  activities: Activity[];
  next_cursor: string | null;
  source_summary: Array<{ provider: string; matched: number; latency_ms: number }>;
}

export interface PoiProviderAdapter {
  provider: "google_places" | "foursquare";
  search(req: ActivitySearchRequest): Promise<ActivitySearchResult>;
  details(activityProviderRef: string): Promise<Activity>;
}

export interface BookableProviderAdapter {
  provider: "viator";
  search(req: ActivitySearchRequest): Promise<ActivitySearchResult>;
  getBookingLink(activityProviderRef: string): Promise<{ url: string; expires_at?: string | null }>;
}
```

## Normalization Rules
- All providers map to canonical `Activity` contract before leaving edge function.
- Missing optional facts are `null`, never omitted.
- `rating_average` rounded to one decimal place.
- `country_code` normalized to ISO 3166-1 alpha-2 uppercase.
- `duration_minutes_min/max` required when provider supplies duration semantics.

## Timeout and Retry Policy
| Layer | Value | Rule |
|---|---|---|
| DNS + connect timeout | 1500ms | Abort request if connection not established. |
| Provider request timeout | 3500ms | Hard timeout per provider call. |
| End-to-end API budget | 6000ms | Return partial results if one provider times out. |
| Retries | max 2 | Retry only retryable classes (network/429/5xx). |
| Backoff | 250ms, 750ms | Exponential with jitter ±20%. |

## Retry Matrix
| Error Class | Retry | Notes |
|---|---|---|
| Network transient (`ECONNRESET`, timeout) | Yes | Up to max retries. |
| `429` | Yes | Respect provider `Retry-After` if present. |
| `500-599` | Yes | Retry unless provider marks non-retryable. |
| `400-404` | No | Contract/input issue or no resource. |
| `401-403` | No | Credential/config issue, raise alert. |

## Circuit Breaker Rules
- Per-provider rolling window: 20 calls.
- Open circuit if error rate >= 60% and at least 12 calls in window.
- Open duration: 120 seconds.
- Half-open probe: 2 requests before closing.
- Fallback during open: serve cached recent results + alternate provider.

## Error Envelope (Required)
```json
{
  "ok": false,
  "contract_version": "travel-v1",
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "Google Places request timed out",
    "retryable": true,
    "provider": "google_places"
  },
  "meta": {
    "request_id": "uuid",
    "generated_at": "2026-04-19T19:00:00Z"
  }
}
```

## Caching Policy
| Endpoint | Cache Key | TTL | Invalidation |
|---|---|---|---|
| Search | query + filter hash + city/radius | 5 minutes | Filter hash change or manual bust flag. |
| Details | provider + provider_ref | 30 minutes | Provider data refresh or booking click refresh. |
| Photos | provider + photo_ref | 24 hours | Provider image fetch failure or changed ref. |

## Observability Requirements
- Log per-provider latency, status code, retries, and fallback activation.
- Emit events:
1. `provider_request_started`
2. `provider_request_succeeded`
3. `provider_request_failed`
4. `provider_fallback_used`
5. `provider_circuit_opened`

## Acceptance Gates
1. Adapter integration tests cover 200/429/500/timeout scenarios.
2. Partial-result response works when one provider fails.
3. UX receives stable envelope and recovery message in all failure paths.
