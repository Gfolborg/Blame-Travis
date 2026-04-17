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
    const body = await req.json();
    const { action } = body;

    // 1. PLOT FEASIBLE ANCHORS (For Roamers)
    if (action === 'plan-anchors') {
      console.log(`[EDGE] Strategic Planning for ${body.days} days near ${JSON.stringify(body.start)}`);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://blametravis.com',
          'X-Title': 'Blame Travis',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001', 
          messages: [
            {
              role: 'system',
              content: `You are Travis, the world's most sophisticated travel agent and adventure architect. 
              Your goal is to plan a regional road trip starting at coordinates [${body.start.lat}, ${body.start.lng}] for exactly ${body.days} days.
              
              STRATEGIC GUIDELINES:
              1. BE REASONABLE: Do not suggest cities that are too far apart. Use your knowledge of global geography.
              2. PACING: Determine if the user should stay in one city for multiple days or move frequently based on the region's density.
              3. TRANSIT DAYS: If a move between two hubs takes more than 3-4 hours of driving, dedicate a day as "type": "transit". 
              4. COORDINATES: For transit days, provide coordinates of a scenic midpoint or a notable roadside town.
              5. ANCHORS: Divide the ${body.days} days into a logical sequence of "explore" (hub stays) and "transit" (road trip days) phases.
              
              OUTPUT JSON ONLY:
              {
                "anchors": [
                  { "name": "City Name", "lat": 0.0, "lng": 0.0, "dayStart": 1, "dayEnd": 2, "type": "explore" },
                  { "name": "The Road to [Next City]", "lat": 0.0, "lng": 0.0, "dayStart": 3, "dayEnd": 3, "type": "transit" }
                ]
              }`
            }
          ],
          response_format: { type: "json_object" }
        }),
      });
      const data = await response.json();
      
      if (data.error) {
         console.error('[ANCHORS] AI Error:', data.error);
         throw new Error(data.error.message || 'AI Anchor Failure');
      }

      const content = JSON.parse(data.choices[0].message.content);
      return new Response(JSON.stringify(content), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. GENERATE ITINERARY NARRATIVE (Standard)
    const { vibes, location, budget, stops, weather, days, isRoamer } = body;
    const weatherPrompt = weather ? `CURRENT CONDITIONS: ${weather}. ` : "";
    const roamerContext = isRoamer ? "This is a regional road trip, connecting multiple hubs." : "This is a base-camp style trip, exploring one area thoroughly.";

    console.log(`[EDGE] Generating narrative for ${stops.length} stops...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://blametravis.com',
        'X-Title': 'Blame Travis',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001', 
        messages: [
          {
            role: 'system',
            content: `PERSONA: You are Travis, the world's most discerning adventure architect. 
            ${roamerContext}
            Total Days: ${days}.
            
            VOICE: Positive, bold, witty, sarcastic. No military language. Use explorer terms.
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
            1. Title: 2-4 words legendary title.
            2. Main Goal: Single impact sentence.
            3. Bonus Goal: Side-quest.
            4. Briefing: 2-sentence intro acknowledging the ${days}-day duration and vibe.
            5. Stop Insights: One sentence remark for each stop.

            JSON OUTPUT FORMAT:
            {
              "title": "...",
              "main_goal": "...",
              "bonus_goal": "...",
              "why_travis_picked_this": "...",
              "stop_insights": ["...", ...]
            }`
          }
        ],
        response_format: { type: "json_object" }
      }),
    })

    const data = await response.json()
    
    if (data.error) {
       console.error('[NARRATIVE] AI Error:', data.error);
       throw new Error(data.error.message || 'AI Narrative Failure');
    }

    const content = data.choices[0].message.content;
    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[EDGE ERROR]:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
