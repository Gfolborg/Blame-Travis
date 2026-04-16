import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")
const PLACES_API_BASE = 'https://places.googleapis.com/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const photoName = url.searchParams.get("name")
    const maxWidth = url.searchParams.get("maxWidthPx") || "800"

    if (!photoName) {
      return new Response("Missing photo name", { status: 400 })
    }

    const googleUrl = `${PLACES_API_BASE}/${photoName}/media?key=${GOOGLE_MAPS_API_KEY}&maxWidthPx=${maxWidth}`
    
    const response = await fetch(googleUrl)
    
    if (!response.ok) {
      return new Response("Failed to fetch image from Google", { status: response.status })
    }

    // Stream the image back
    const imageBuffer = await response.arrayBuffer()
    
    return new Response(imageBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
