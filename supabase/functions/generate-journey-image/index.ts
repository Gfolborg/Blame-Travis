import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { decode } from "https://deno.land/std@0.178.0/encoding/base64.ts"

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
    const { title, location, adventureId, goal, stops } = await req.json()
    console.log(`[IMAGE] Request received: ${title} in ${location} for ${adventureId}`)

    const stopsContext = stops && stops.length > 0 ? ` featuring spots like ${stops.join(', ')}` : '';
    const goalContext = goal ? `. The theme is: ${goal}` : '';

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
        model: 'google/gemini-2.5-flash-image', 
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `GENERATE_IMAGE: A cinematic, high-fidelity fine-art travel photograph of ${location}${stopsContext}${goalContext}. 
                Style: Analog film photography, Kodak Portra 400 aesthetic, grainy texture, warm golden hour lighting, 
                sophisticated composition, minimal, professional. 
                No text, no people, no digital-looking illustrations.`
              }
            ]
          }
        ],
        // Explicit image generation parameters
        aspect_ratio: "9:16",
        provider: {
          "sort": "throughput"
        }
      }),
    })

    const data = await response.json()
    console.log('[IMAGE] OpenRouter response received')
    
    // Extract Image URL or Base64
    let imageData = null;
    let isBase64 = false;

    // Check OpenRouter multimodal structure (choices[0].message.images[0].image_url.url)
    const firstChoice = data.choices?.[0];
    const messageImages = firstChoice?.message?.images;
    
    if (messageImages?.[0]?.image_url?.url) {
      imageData = messageImages[0].image_url.url;
    } else if (firstChoice?.message?.content?.startsWith('http')) {
      imageData = firstChoice.message.content;
    } else if (data.data?.[0]?.url) {
      imageData = data.data[0].url;
    }

    if (!imageData) {
      console.error('[IMAGE] Could not find image in response:', JSON.stringify(data))
      throw new Error("Failed to receive image data from provider")
    }

    let finalBlob;
    if (imageData.startsWith('data:image')) {
      console.log('[IMAGE] Handling Base64 data...')
      isBase64 = true;
      const base64Content = imageData.split(',')[1];
      const binaryData = decode(base64Content);
      finalBlob = new Blob([binaryData], { type: 'image/png' });
    } else {
      console.log(`[IMAGE] Downloading from URL: ${imageData}`)
      const imageRes = await fetch(imageData)
      finalBlob = await imageRes.blob()
    }

    // 3. Store in Supabase Storage
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const fileName = `${adventureId}_hero.jpg`
    
    const { error: uploadError } = await supabase.storage
      .from('adventure-heros')
      .upload(fileName, finalBlob, {
        contentType: isBase64 ? 'image/png' : 'image/jpeg',
        upsert: true
      })

    if (uploadError) throw uploadError

    // 4. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('adventure-heros')
      .getPublicUrl(fileName)

    console.log(`[IMAGE] Public URL generated: ${publicUrl}`)

    // 5. Update the Adventure record
    const { error: dbError } = await supabase
      .from('adventures')
      .update({ hero_image_url: publicUrl })
      .eq('id', adventureId)

    if (dbError) {
      console.error('[IMAGE] Database update failed:', dbError)
      throw dbError
    }

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
