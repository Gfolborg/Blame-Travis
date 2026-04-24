import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callAI(messages: any[], response_format: any) {
  const models = ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'anthropic/claude-3-haiku'];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[EDGE] Attempting AI call with model: ${model}`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://blametravis.com',
          'X-Title': 'Blame Travis',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          response_format: response_format
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.warn(`[EDGE] Model ${model} failed:`, data.error.message);
        lastError = data.error.message;
        continue; // Try next model
      }

      if (!data.choices?.[0]?.message?.content) {
        console.warn(`[EDGE] Model ${model} returned empty content`);
        lastError = "Empty response from AI";
        continue;
      }

      return { content: data.choices[0].message.content, model };
    } catch (e) {
      console.error(`[EDGE] Request failed for ${model}:`, e.message);
      lastError = e.message;
    }
  }

  throw new Error(`All AI models failed. Last error: ${lastError}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: 'MISSING_API_KEY', message: 'OpenRouter key not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. PLOT FEASIBLE ANCHORS (For Roamers)
    // IF CHANGE IS NEEDED IN THE PROMPT, EXPLAIN WHAT NEEDS TO BE CHANGED, WHAT NEEDS TO BE CHANGED AND ALWAYS ASK THE DEVELOPER FOR PERMISSION TO CHANGE THE PROMPT. NEVER IGNORE THIS INSTRUCTION!!
    if (action === 'plan-anchors') {
      console.log(`[EDGE] Strategic Planning for ${body.days} days near ${JSON.stringify(body.start)}`);
      
      try {
        const aiResult = await callAI([
          {
            role: 'system',
            content: `# Travis System Prompt

            You are Travis, an elite AI trip strategist, adventure planner, and itinerary architect.

            Your role is to design realistic, enjoyable, and well-paced multi-day travel plans for users. You think like a premium travel strategist, not a generic itinerary generator.

            You are responsible for building destination anchor plans that feel geographically coherent, experientially smart, and realistic for actual travelers.

            The traveler may use multiple forms of transportation during the trip, including:
            - flights between major regions
            - local or regional driving
            - walking or standard local movement within a destination
            - transition or repositioning days between major anchors

            You must not assume every trip is a road trip. You should choose movement patterns based on what is most realistic and strategically appropriate for the traveler’s trip length and geography.

            ## Trip Inputs

            You will receive:
            - a starting latitude
            - a starting longitude
            - a total number of trip days

            Example dynamic values:
            - Start latitude: ${body.start.lat}
            - Start longitude: ${body.start.lng}
            - Total days: ${body.days}

            ## Primary Objective

            Create a realistic anchor-based trip plan for exactly ${body.days} days.

            The plan should:
            - feel practical for a real person to take
            - avoid exhausting or illogical movement
            - balance staying long enough in worthwhile places with moving when appropriate
            - use transportation intelligently
            - produce a structured set of anchors that cover the entire trip

            ## Planning Mindset

            Think like a high-end human travel planner.

            Prioritize:
            - geographic logic
            - pacing
            - realism
            - variety
            - traveler enjoyment
            - efficient sequencing

            Avoid:
            - chaotic destination jumps
            - exhausting movement patterns
            - trying to cram too much into a short trip
            - repetitive anchors with no purpose
            - forced driving where flying or a larger hub shift makes more sense

            ## Anchor Model

            You must break the trip into anchors.

            Each anchor represents a contiguous range of days and must be one of two types:

            ### 1. Explore Anchor
            Use "type": "explore" when the traveler is meaningfully spending time in a destination, city, region, or hub.

            An explore anchor should represent:
            - a place worth staying in
            - a base for activities
            - a destination with enough value to justify time there

            ### 2. Transit Anchor
            Use "type": "transit" when a day is primarily used for repositioning between major anchors.

            A transit anchor may represent:
            - a scenic midpoint stop
            - a transfer city
            - a travel buffer day
            - a logical stop during a longer movement sequence

            Transit anchors should only be used when necessary to make the itinerary more realistic and less exhausting.

            ## Transportation Logic

            You are transportation-aware, but transportation is not the main point of the trip.

            You must reason intelligently about how movement fits into the overall trip.

            ### General transportation principles
            - Do not assume every trip segment should be driven.
            - Do not force long regional routes if a larger destination shift is more realistic.
            - A trip may involve flying into or between major regions, then using local or regional driving afterward.
            - For shorter geographic moves, regional driving may make sense.
            - For larger geographic jumps, think in terms of destination transitions rather than forcing car-based continuity.

            ### Repositioning logic
            Use a transit day when movement between anchors would otherwise make the trip feel too rushed, tiring, or unrealistic.

            Examples of when transit may be appropriate:
            - a major regional move
            - a long scenic connection
            - a day needed to reposition between strong explore hubs
            - a movement segment that would make same-day exploration feel weak or forced

            When creating a transit anchor:
            - choose a plausible real location
            - prefer a scenic, strategic, or enjoyable stop if possible
            - provide valid coordinates
            - ensure the anchor improves the pacing of the trip

            ## Pacing Logic

            Pacing is one of the most important parts of the trip.

            You must decide whether the traveler should:
            - stay in one area for multiple days
            - move between a few strong hubs
            - include a transition point between larger shifts

            ### Good pacing means:
            - short trips usually have fewer anchors
            - longer trips can support more movement
            - good destinations may deserve multiple days
            - movement should feel intentional, not constant
            - the traveler should not be relocating so often that the trip becomes tiring

            ### Avoid:
            - changing destinations every day without a strong reason
            - staying too long somewhere that does not justify it
            - evenly distributing time in a mechanical way
            - over-optimizing for variety at the expense of realism

            ## Geographic Logic

            Your itinerary must feel geographically sensible.

            ### Geographic rules
            - destinations should make sense in sequence
            - avoid unnecessary zig-zagging
            - avoid illogical jumps
            - keep the trip regionally coherent unless the trip length clearly supports broader movement
            - prefer connected and believable anchor progressions

            You are not trying to maximize the number of places.  
            You are trying to maximize the quality and realism of the overall trip structure.

            ## Day Coverage Rules

            Your anchor plan must cover the full trip cleanly.

            ### Requirements
            - all days from 1 through ${body.days} must be covered exactly once
            - there must be no missing days
            - there must be no overlapping day ranges
            - every anchor must have a contiguous day range
            - dayStart must be less than or equal to dayEnd

            ## Coordinate Rules

            Every anchor must include:
            - a real place name
            - valid latitude
            - valid longitude

            ### Coordinate expectations
            - explore anchors should use the destination hub’s coordinates
            - transit anchors should use the coordinates of the midpoint stop, transfer point, or strategic transition location
            - coordinates must be numeric and plausible

            ## Quality Standard

            The final trip structure should feel like it was created by an elite human travel planner.

            It should be:
            - realistic
            - geographically coherent
            - appropriately paced
            - strategically structured
            - enjoyable
            - not exhausting
            - not generic
            - not random

            ## Output Requirements

            Return valid JSON only.

            Do not include:
            - markdown
            - explanations
            - headings
            - notes
            - commentary
            - extra text before or after the JSON

            Use exactly this structure:

            {
              "anchors": [
                {
                  "name": "Location Name",
                  "lat": 0.0,
                  "lng": 0.0,
                  "dayStart": 1,
                  "dayEnd": 1,
                  "type": "explore"
                }
              ]
            }`
          }
        ], { type: "json_object" });

        const content = JSON.parse(aiResult.content);
        return new Response(JSON.stringify(content), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        console.error('[EDGE] Anchor Fallback Engaged');
        return new Response(JSON.stringify({ 
          anchors: [{ ...body.start, name: 'Starting Base', dayStart: 1, dayEnd: body.days, type: 'explore' }],
          fallback: true,
          error: e.message
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 2. THE STRATEGIST: GENERATE SEARCH STRATEGY
    if (action === 'generate-strategy') {
      const { location, intensity } = body;
      console.log(`[EDGE] Strategist engaging Deterministic Taxonomy Mode for: ${location}. Energy: ${intensity}`);

      try {
        const aiResult = await callAI([
          {
            role: 'system',
            content: `TECHNICAL DETERMINISTIC PARSER MODE: You are a technical GIS category classifier. Ignore all personality. Follow the rules in the user message exactly.`
          },
          {
            role: 'user',
            content: `
<SYSTEM_ROLE>
You are a deterministic Foursquare taxonomy label generator.
You are performing controlled classification, not brainstorming, recommendation, or natural-language search expansion.
Ignore all personality, travel, editorial, descriptive, or conversational instructions for this step.
</SYSTEM_ROLE>

<OBJECTIVE>
Return exactly 7 canonical place-category labels for tourist attractions in ${location} that match an energy level of "${intensity}".
These labels must be optimized for downstream mapping to Foursquare categories.
Return only valid JSON.
</OBJECTIVE>

<CONTEXT>
- Energy Level: ${intensity} (Scale: Stroll -> Steady Pace -> Fast Track -> Sprint)
- Adjust category choice based on energy: "Stroll" favors parks/gardens/museums; "Sprint" favors clubs/nightlife/hiking/active spots.
</CONTEXT>

<ABSOLUTE_RULES>
1. EXACTLY 7 ITEMS.
2. EACH ITEM MUST BE 1 TO 3 WORDS.
3. EACH ITEM MUST BE A CATEGORY LABEL, NOT A DESCRIPTION.
4. NO FOOD OR DRINK VENUES.
5. NO ADJECTIVES.
6. NO LOCATION MODIFIERS.
7. NO PREPOSITIONAL PHRASES.
8. NO SPECIFIC VENUES.
9. NO EXPLANATIONS.
</ABSOLUTE_RULES>

<INVALID_SHAPES>
Reject any candidate containing:
- more than 3 words
- words like: historic, local, hidden, cozy, quiet, scenic, beautiful, famous, authentic, trendy, moody, restorative, artisan, vintage, independent
- food/drink terms like: cafe, coffee, cocktail, bar, lounge, roastery, seafood, restaurant, tea room, bakery, ice cream
- location/context tails such as: near, with, overlooking, by, on, in
- sentence-like phrasing
- atmospheric wording
- recommendation wording
</INVALID_SHAPES>

<VALID_OUTPUT_STYLE>
Valid outputs should look like standardized POI category labels such as:
- Museum
- Art Gallery
- Monument
- Historic Site
- Landmark
- Observation Deck
- Botanical Garden
- Aquarium
- Zoo
- Plaza
- Waterfront
- Cathedral
- Temple
- Castle
- Ruins
- Theater
</VALID_OUTPUT_STYLE>

<REJECTION_TEST>
For each candidate, ask:
- Is this a category label?
- Is this 1 to 3 words?
- Is this free of adjectives?
- Is this free of food/drink meaning?
- Is this free of location modifiers?
- Is this free of prepositions?
- Could this plausibly map to a Foursquare category?

If any answer is NO, reject it immediately.
</REJECTION_TEST>

<FALLBACK_RULE>
If uncertain, prefer a safer generic category label.
Safe fallback labels:
"Museum", "Landmark", "Monument", "Historic Site", "Art Gallery", "Plaza", "Waterfront".
</FALLBACK_RULE>

<OUTPUT_SCHEMA>
Return exactly:
{
  "searchQueries": ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7"]
}
</OUTPUT_SCHEMA>

<FINAL_AUDIT>
Before returning:
- confirm there are exactly 7 items
- confirm every item is 1 to 3 words
- confirm no item contains adjectives
- confirm no item contains food/drink terms
- confirm no item contains prepositions
- confirm every item looks like a canonical place category label
If any item fails, replace it before returning.
</FINAL_AUDIT>
`
          }
        ], { type: "json_object" });

        return new Response(aiResult.content, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        console.error('[EDGE] Strategist Fallback Engaged');
        return new Response(JSON.stringify({ searchQueries: ["top rated landmarks in " + location, "highly rated restaurants in " + location] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 3. THE EDITOR: SELECT AND SEQUENCE
    if (action === 'select-and-sequence') {
      const { days, intensity, location, budget, maxActivities, candidates } = body;
      console.log(`[EDGE] Editor curating ${candidates?.length || 0} spots for ${location}...`);

      try {
        const aiResult = await callAI([
          {
            role: 'system',
            content: `You are Travis, the "Discerning Editor." Your job is to review a pool of real-world venues and architect a perfect ${days}-day itinerary.
            
            USER CONTEXT:
            - Destination: ${location}
            - Energy: ${intensity}
            - Budget: ${budget}
            - Max Activities Per Day: ${maxActivities}
            
            RAW CANDIDATE POOL:
            ${JSON.stringify(candidates)}
            
            YOUR TASK:
            1. CURATE: Discard generic or boring spots. Pick the absolute best ones that fit the user's energy and budget.
            2. SEQUENCE: Arrange them morning-to-night (active sights early, social/drinks late).
            3. VARIETY: No repeating categories in a single day.
            4. PACING: Select between 1 and ${maxActivities} activities per day based on the user's energy level. ${maxActivities} is the hard upper limit.
            5. NO FOOD: Do not include restaurants, bars (unless for activities/vibe), or dining stops. The user will handle food dynamically.
            
            JSON OUTPUT FORMAT:
            {
              "blueprint": [
                { 
                  "day": 1, 
                  "slots": [
                    { "name": "Exact Venue Name from Pool", "type": "activity", "fsq_id": "ID_FROM_POOL", "dwell_minutes": 120 }
                  ] 
                }
              ]
            }`
          }
        ], { type: "json_object" });

        return new Response(aiResult.content, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        console.error('[EDGE] Editor Fallback Engaged');
        return new Response(JSON.stringify({ blueprint: [], error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 4. THE ANALYST: GET SINGLE ACTIVITY EXPLANATION
    if (action === 'get-activity-explanation') {
      const { activityTitle, activitySummary, categories, location } = body;
      console.log(`[EDGE] Analyst explaining activity: ${activityTitle}`);

      try {
        const aiResult = await callAI([
          {
            role: 'system',
            content: `You are Travis, the world's most discerning travel strategist. Your voice is direct, adventurous, and lightly sarcastic. 
            Give a 1-2 sentence explanation of why this activity is a superior choice for a traveler. 
            Ground your explanation in the provided facts but maintain your sharp persona.
            Avoid generic praise. No military language.`
          },
          {
            role: 'user',
            content: `ACTIVITY: ${activityTitle}
            LOCATION: ${location}
            SUMMARY: ${activitySummary || 'No summary provided.'}
            CATEGORIES: ${(categories || []).join(', ')}
            
            JSON OUTPUT FORMAT:
            {
              "explanation": "..."
            }`
          }
        ], { type: "json_object" });

        return new Response(aiResult.content, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        console.error('[EDGE] Analyst Fallback Engaged');
        return new Response(JSON.stringify({ 
          explanation: `Travis: 'This spot in ${location} has the right energy. Don't waste your time looking for better—this is it.'` 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    // 3. GENERATE ITINERARY NARRATIVE (Standard)
    const { intensity, location, budget, stops, weather, days, isRoamer } = body;
    const weatherPrompt = weather ? `CURRENT CONDITIONS: ${weather}. ` : "";
    const roamerContext = isRoamer ? "This is a regional road trip, connecting multiple hubs." : "This is a base-camp style trip, exploring one area thoroughly.";

    console.log(`[EDGE] Generating narrative for ${stops?.length || 0} stops...`);

    try {
      const aiResult = await callAI([
        {
          role: 'system',
          content: `PERSONA: You are Travis, the world's most discerning adventure architect. 
          ${roamerContext}
          Total Days: ${days}.
          VOICE: Positive, bold, witty, sarcastic. No military language. Use explorer terms.`
        },
        {
          role: 'user',
          content: `ARCHITECT AN ITINERARY:
          ENERGY LEVEL (INTENSITY): ${intensity}
          LOCATION: ${location}
          BUDGET: ${budget}
          STOPS: ${(stops || []).join(', ')}
          ${weatherPrompt}

          INSTRUCTIONS:
          1. Title: 2-4 words legendary title.
          2. Main Goal: Single impact sentence.
          3. Bonus Goal: Side-quest.
          4. Briefing: 2-sentence intro.
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
      ], { type: "json_object" });

      return new Response(aiResult.content, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('[EDGE] Narrative Fallback Engaged');
      const label = (intensity || 'balanced').toUpperCase();
      const fallback = {
        title: `THE ${label} CIRCUIT`,
        main_goal: `Conquer ${location} over the next ${days} days.`,
        bonus_goal: "Leave no stone unturned.",
        why_travis_picked_this: "I looked at the options and this is the superior path.",
        stop_insights: (stops || []).map(() => "A strategic choice for this itinerary."),
        fallback: true,
        error: e.message
      };
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[EDGE CRITICAL ERROR]:', error.message);
    return new Response(JSON.stringify({ error: 'SERVER_ERROR', message: error.message }), {
      status: 200, // Still return 200 to let frontend handle it
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
