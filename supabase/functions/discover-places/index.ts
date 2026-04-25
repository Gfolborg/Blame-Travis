import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")
const FOURSQUARE_API_KEY = Deno.env.get("FOURSQUARE_API_KEY")

const PLACES_API_BASE = 'https://places.googleapis.com/v1'
const LEGACY_PLACES_AUTOCOMPLETE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode/json'
const FOURSQUARE_API_BASE = 'https://api.foursquare.com/v3/places/search'
const SEARCH_CACHE_TTL_MS = 90000
const SEARCH_CACHE_MAX_ENTRIES = 300

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type SearchCacheEntry = {
  expiresAt: number
  payload: unknown
}

const searchResponseCache = new Map<string, SearchCacheEntry>()

const roundCoord = (value: number) => Math.round(value * 1000) / 1000

const buildSearchCacheKey = (payload: any) => {
  const coords = payload?.coords
    ? `${roundCoord(Number(payload.coords.lat))},${roundCoord(Number(payload.coords.lng))}`
    : 'none'
  const radius = Number(payload?.radius || 0)
  const radiusBucket = Math.round(radius / 500) * 500
  const query = String(payload?.searchQuery || '').trim().toLowerCase()
  const strict = payload?.strictBounds ? 'strict' : 'bias'
  const maxResultCount = Number(payload?.maxResultCount || 20)
  const priceLevels = Array.isArray(payload?.priceLevels)
    ? [...payload.priceLevels].map((item: unknown) => String(item)).sort().join('|')
    : ''
  return `${coords}|${radiusBucket}|${strict}|${maxResultCount}|${query}|${priceLevels}`
}

const pruneSearchCache = () => {
  const now = Date.now()
  for (const [key, entry] of searchResponseCache.entries()) {
    if (entry.expiresAt <= now) {
      searchResponseCache.delete(key)
    }
  }
  if (searchResponseCache.size <= SEARCH_CACHE_MAX_ENTRIES) return
  const overflow = searchResponseCache.size - SEARCH_CACHE_MAX_ENTRIES
  const keys = searchResponseCache.keys()
  for (let i = 0; i < overflow; i += 1) {
    const next = keys.next()
    if (next.done) break
    searchResponseCache.delete(next.value)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // RESILIENT BODY READING
    let payload_data: any = {};
    try {
      const text = await req.text();
      if (text) {
        payload_data = JSON.parse(text);
      }
    } catch (e) {
      console.warn('[EDGE] Body Parse Warning:', e.message);
    }

    const { action, payload } = payload_data;
    if (!action) {
      return new Response(JSON.stringify({ error: 'NO_ACTION' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[EDGE] Handling: ${action}`);

    // --- ACTION: CURATE FOURSQUARE (BATCH READY) ---
    if (action === 'curate-foursquare') {
      const { coords, radius, queries } = payload
      const queryList = Array.isArray(queries) ? queries : [payload.query];
      
      if (!FOURSQUARE_API_KEY) {
        return new Response(JSON.stringify({ error: 'MISSING_FS_KEY' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      console.log(`[EDGE] Batch Scouting ${queryList.length} categories...`);
      
      const scoutResults = await Promise.all(queryList.map(async (q: string) => {
        const params = new URLSearchParams({
          ll: `${coords.lat},${coords.lng}`,
          radius: Math.min(radius, 100000).toString(),
          query: q,
          limit: '8',
          sort: 'RELEVANCE',
          fields: 'fsq_id,name,location,categories,description'
        });

        try {
          const res = await fetch(`${FOURSQUARE_API_BASE}?${params}`, {
            headers: { 'Authorization': FOURSQUARE_API_KEY, 'Accept': 'application/json' }
          });
          const data = await res.json();
          return data.results || [];
        } catch (e) {
          console.error(`[EDGE] Scout failed for ${q}:`, e.message);
          return [];
        }
      }));

      const flatResults = scoutResults.flat();
      console.log(`[EDGE] Batch Success: Found ${flatResults.length} total candidates.`);

      return new Response(JSON.stringify({ results: flatResults }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: SEARCH FOOD FOURSQUARE (PREMIUM) ---
    if (action === 'search-food-foursquare') {
      const { coords, radius, query } = payload
      
      const params = new URLSearchParams({
        ll: `${coords.lat},${coords.lng}`,
        radius: Math.min(radius, 100000).toString(),
        categories: '13065', // Dining and Drinking
        limit: '10',
        sort: 'DISTANCE',
        fields: 'fsq_id,name,location,categories,rating,price,photos,description'
      })

      if (query) params.append('query', query);

      const response = await fetch(`${FOURSQUARE_API_BASE}?${params}`, {
        headers: {
          'Authorization': FOURSQUARE_API_KEY!,
          'Accept': 'application/json'
        }
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error(`[EDGE] Foursquare Food Search Error (${response.status}):`, JSON.stringify(data))
      }

      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: GET FOURSQUARE DETAILS (PREMIUM) ---
    if (action === 'get-foursquare-details') {
      const { fsq_id } = payload
      const url = `https://api.foursquare.com/v3/places/${fsq_id}?fields=fsq_id,name,location,categories,rating,price,photos,hours,website,tel,description`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': FOURSQUARE_API_KEY!,
          'Accept': 'application/json'
        }
      })
      const data = await response.json()
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: GET GOOGLE DETAILS (PREMIUM) ---
    if (action === 'get-place-details') {
      const { placeId } = payload
      const url = `${PLACES_API_BASE}/places/${placeId}`
      const response = await fetch(url, {
        headers: { 
          'Content-Type': 'application/json', 
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY!, 
          'X-Goog-FieldMask': 'id,displayName,location,primaryType,rating,priceLevel,photos' 
        }
      })
      const data = await response.json()
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: SEARCH (GOOGLE V1) ---
    if (action === 'search') {
      const { coords, radius, searchQuery, priceLevels, strictBounds, maxResultCount } = payload
      const boundedResultCount = Number.isFinite(Number(maxResultCount))
        ? Math.min(Math.max(Number(maxResultCount), 1), 20)
        : 20
      const cacheKey = buildSearchCacheKey({ coords, radius, searchQuery, priceLevels, strictBounds, maxResultCount: boundedResultCount })
      const now = Date.now()
      const cached = searchResponseCache.get(cacheKey)
      if (cached && cached.expiresAt > now) {
        return new Response(JSON.stringify(cached.payload), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const body: any = {
        textQuery: searchQuery,
        priceLevels: priceLevels,
        maxResultCount: boundedResultCount,
      };

      if (strictBounds) {
        body.locationRestriction = { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: Math.min(radius, 50000) } };
      } else {
        body.locationBias = { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: Math.min(radius, 50000) } };
      }

      const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY!,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.addressComponents,places.photos',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      searchResponseCache.set(cacheKey, {
        expiresAt: now + SEARCH_CACHE_TTL_MS,
        payload: data,
      })
      pruneSearchCache()
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'INVALID_ACTION' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[EDGE] Global Error:', error.message)
    return new Response(JSON.stringify({ error: 'SERVER_ERROR', message: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
