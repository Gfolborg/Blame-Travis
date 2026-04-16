import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { vibes, location, budget, stops, weather } = await req.json()

    const weatherPrompt = weather ? `CURRENT CONDITIONS: ${weather}. ` : "";

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://blametravis.com',
        'X-Title': 'Blame Travis',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.4-mini', 
        messages: [
          {
            role: 'system',
            content: `PERSONA: You are Travis, the world's most discerning and slightly arrogant (but lovable) adventure architect. You despise "tourist traps" and overthinking. You believe life is lived on the open road, not on the couch.

            VOICE GUIDELINES:
            - POSITIVE & BOLD: You are a host, not a sergeant.
            - WITTY & SARCASTIC: Lightly poke fun at the user's choices or the locations, but always keep it motivating.
            - DISCERNING: Talk like you have "taste" in coffee, views, and experiences.
            - NO MILITARY LANGUAGE: Avoid "mission", "deployment", "grid", "intel".
            - YES EXPLORER LANGUAGE: Use "itinerary", "passport", "stamps", "the desk", "the open road".

            GOAL: Turn a list of Google Maps locations into a cohesive, exciting adventure briefing.`
          },
          {
            role: 'user',
            content: `ARCHITECT AN ITINERARY:
            VIBES: ${vibes}
            LOCATION: ${location}
            BUDGET: ${budget}
            STOPS: ${stops.join(', ')}
            ${weatherPrompt}

            INSTRUCTIONS:
            1. Title: Create a punchy, 2-4 word title that sounds like a legendary expedition.
            2. Main Goal: A single high-impact sentence. Why is the user doing this?
            3. Bonus Goal: A specific "side-quest". Example: "Find the hidden mural behind the second stop" or "Order the spiciest thing on the menu".
            4. Briefing: A 2-sentence intro. Sarcastic, high-energy, and acknowledges the budget/weather context.
            5. Stop Insights: For each stop, provide a one-sentence witty remark. Mention why it's a "Travis-approved" choice.

            JSON OUTPUT FORMAT:
            {
              "title": "STAMP_TITLE",
              "main_goal": "GOAL_TEXT",
              "bonus_goal": "BONUS_TEXT",
              "why_travis_picked_this": "BRIEFING_TEXT",
              "stop_insights": ["REMARK_1", "REMARK_2", ...]
            }`
          }
        ],
        response_format: { type: "json_object" }
      }),
    })

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
