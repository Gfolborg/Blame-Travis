import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")
const WEATHER_API_BASE = 'https://weather.googleapis.com/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lat, lng, type = 'current' } = await req.json()

    let url = `${WEATHER_API_BASE}/currentConditions:lookup?key=${GOOGLE_MAPS_API_KEY}`
    
    if (type === 'daily') {
      url = `${WEATHER_API_BASE}/forecast/days:lookup?key=${GOOGLE_MAPS_API_KEY}`
    } else if (type === 'hourly') {
      url = `${WEATHER_API_BASE}/forecast/hours:lookup?key=${GOOGLE_MAPS_API_KEY}`
    }

    // Location parameters for the Weather API
    const params = new URLSearchParams({
      'location.latitude': lat.toString(),
      'location.longitude': lng.toString(),
    })

    const finalUrl = `${url}&${params.toString()}`

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Weather API Error:', err)
      throw new Error(`Weather API failed: ${response.status}`)
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
