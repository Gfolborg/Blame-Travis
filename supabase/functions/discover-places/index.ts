import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")
const PLACES_API_BASE = 'https://places.googleapis.com/v1'
const GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode/json'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, payload } = await req.json()
    console.log(`[EDGE] Action: ${action}`, payload)

    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("GOOGLE_MAPS_API_KEY is not set in Supabase secrets")
    }

    if (action === 'autocomplete') {
      const { input } = payload
      const url = `${PLACES_API_BASE}/places:autocomplete`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        },
        body: JSON.stringify({
          input: input,
          includedPrimaryTypes: ['(cities)'], // Correct field for New Places API
        }),
      })
      
      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'geocode') {
      const { query } = payload
      const url = `${GEOCODING_API_BASE}?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status !== 'OK') {
        console.error('[EDGE] Geocoding failed:', data)
        return new Response(JSON.stringify({ error: data.status, message: data.error_message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const location = data.results[0].geometry.location;
      const formattedData = {
        places: [{
          location: {
            latitude: location.lat,
            longitude: location.lng
          }
        }]
      };

      return new Response(JSON.stringify(formattedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'search') {
      const { coords, vibe, type, radius, targetCount, priceLevels } = payload
      const url = `${PLACES_API_BASE}/places:searchText`
      
      const query = `highly rated ${vibe} in this area`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.rating',
        },
        body: JSON.stringify({
          textQuery: query,
          includedType: type,
          priceLevels: priceLevels,
          locationBias: {
            circle: {
              center: { latitude: coords.lat, longitude: coords.lng },
              radius: radius,
            },
          },
          maxResultCount: Math.min(Math.ceil(targetCount) + 5, 20),
        }),
      })

      const data = await response.json()
      
      if (!data.places || data.places.length === 0) {
        const fallbackResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.rating',
          },
          body: JSON.stringify({
            textQuery: `${vibe} nearby`,
            locationBias: {
              circle: {
                center: { latitude: coords.lat, longitude: coords.lng },
                radius: Math.max(radius, 20000.0),
              },
            },
            maxResultCount: 10,
          }),
        })
        const fallbackData = await fallbackResponse.json()
        return new Response(JSON.stringify(fallbackData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
