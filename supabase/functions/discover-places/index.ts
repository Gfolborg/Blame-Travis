import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")
const FOURSQUARE_API_KEY = Deno.env.get("FOURSQUARE_API_KEY")

const PLACES_API_BASE = 'https://places.googleapis.com/v1'
const LEGACY_PLACES_AUTOCOMPLETE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode/json'
const FOURSQUARE_API_BASE = 'https://api.foursquare.com/v3/places/search'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    if (!rawBody) {
       return new Response(JSON.stringify({ error: 'EMPTY_BODY' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action, payload } = JSON.parse(rawBody)
    console.log(`[EDGE] Action: ${action}`, payload)

    // --- ACTION: CURATE FOURSQUARE ---
    if (action === 'curate-foursquare') {
      const { coords, radius, query, categories } = payload
      
      if (!FOURSQUARE_API_KEY) {
        return new Response(JSON.stringify({ error: 'MISSING_FS_KEY' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const params = new URLSearchParams({
        ll: `${coords.lat},${coords.lng}`,
        radius: Math.min(radius, 50000).toString(),
        query: query || '',
        categories: categories || '',
        limit: '10',
        sort: 'RELEVANCE'
      })

      const response = await fetch(`${FOURSQUARE_API_BASE}?${params}`, {
        headers: {
          'Authorization': FOURSQUARE_API_KEY,
          'Accept': 'application/json'
        }
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error(`[EDGE] Foursquare API Error (${response.status}):`, data)
      } else {
        console.log(`[EDGE] Foursquare Success: Found ${data.results?.length || 0} candidates for "${query}"`)
      }

      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: AUTOCOMPLETE (LEGACY) ---
    if (action === 'autocomplete') {
      const { input } = payload
      const url = `${LEGACY_PLACES_AUTOCOMPLETE}?input=${encodeURIComponent(input)}&types=(cities)&key=${GOOGLE_MAPS_API_KEY}`
      const response = await fetch(url)
      const data = await response.json()
      
      const suggestions = (data.predictions || []).map((p: any) => ({
        placePrediction: {
          placeId: p.place_id,
          text: { text: p.description }
        }
      }))

      return new Response(JSON.stringify({ suggestions }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: GEOCODE ---
    if (action === 'geocode') {
      const { query, placeId } = payload
      if (placeId) {
        const url = `${PLACES_API_BASE}/places/${placeId}`
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY!, 'X-Goog-FieldMask': 'location' }
        })
        const data = await response.json()
        return new Response(JSON.stringify({ places: [{ location: { latitude: data.location.latitude, longitude: data.location.longitude } }] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const url = `${GEOCODING_API_BASE}?address=${encodeURIComponent(query || '')}&key=${GOOGLE_MAPS_API_KEY}`
      const response = await fetch(url)
      const data = await response.json()
      const location = data.results?.[0]?.geometry?.location;
      return new Response(JSON.stringify({ places: [{ location: { latitude: location?.lat, longitude: location?.lng } }] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: SEARCH (GOOGLE V1) ---
    if (action === 'search') {
      const { coords, radius, searchQuery, priceLevels, strictBounds } = payload
      const body: any = {
        textQuery: searchQuery,
        priceLevels: priceLevels,
        maxResultCount: 20,
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
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.rating',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'INVALID_ACTION' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[EDGE] Global Error:', error.message)
    return new Response(JSON.stringify({ error: 'SERVER_ERROR', message: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
