import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, location, adventureId } = await req.json()
    console.log(`[IMAGE] Generating for: ${title} in ${location}`)

    // 1. Request Image from OpenRouter (Nano Banana)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://blametravis.com',
        'X-Title': 'Blame Travis',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image', // Model string from docs
        messages: [
          {
            role: 'user',
            content: `A high-fidelity vintage travel postcard of ${location}. 
            Style: 1950s travel poster, muted colors, warm sunset lighting, 
            professional illustration, artistic, minimal. 
            No text or people in the image. Aspect ratio 16:9.`
          }
        ],
      }),
    })

    const data = await response.json()
    console.log('[IMAGE] OpenRouter response received.')
    
    // Note: OpenRouter returns a URL for generated images usually or base64.
    // Based on standard image model responses, we expect a 'url' in choices[0].
    const imageUrl = data.choices[0].message.content; // Some providers put the URL here

    if (!imageUrl || !imageUrl.startsWith('http')) {
       throw new Error("Failed to receive image URL from provider")
    }

    // 2. Download the image
    const imageRes = await fetch(imageUrl)
    const blob = await imageRes.blob()

    // 3. Store in Supabase Storage
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const fileName = `${adventureId}_hero.jpg`
    
    const { error: uploadError } = await supabase.storage
      .from('adventure-heros')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) throw uploadError

    // 4. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('adventure-heros')
      .getPublicUrl(fileName)

    // 5. Update the Adventure record
    const { error: dbError } = await supabase
      .from('adventures')
      .update({ hero_image_url: publicUrl })
      .eq('id', adventureId)

    if (dbError) throw dbError

    return new Response(JSON.stringify({ publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[IMAGE] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
