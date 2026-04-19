-- 1. Missing Items Verification (Count parity JSON against successfully generated item allocations)
WITH expected AS (
    SELECT
        ad.adventure_id,
        ad.day_number,
        count(*)::int AS eligible_legacy_stops
    FROM public.adventure_days ad
    CROSS JOIN LATERAL jsonb_array_elements(ad.itinerary_json) WITH ORDINALITY AS arr(stop, ord)
    WHERE jsonb_typeof(ad.itinerary_json) = 'array'
      AND (stop->>'place_id') IS NOT NULL
    GROUP BY ad.adventure_id, ad.day_number
)
SELECT
    e.adventure_id,
    e.day_number,
    e.eligible_legacy_stops,
    count(ii.id)::int AS inserted_items
FROM expected e
JOIN public.itineraries i ON i.legacy_adventure_id = e.adventure_id
LEFT JOIN public.itinerary_items ii ON ii.itinerary_id = i.id AND ii.day_index = e.day_number
GROUP BY e.adventure_id, e.day_number, e.eligible_legacy_stops
HAVING e.eligible_legacy_stops != count(ii.id);
-- (Expected Return: 0 rows - ensures NO stops are implicitly dropped from conflicts)

-- 2. Row Parity: Total deterministic matching to validate missing or improperly scoped mappings
SELECT 
    a.user_id,
    COUNT(DISTINCT a.id) as legacy_adventures,
    COUNT(DISTINCT i.legacy_adventure_id) as new_itineraries
FROM public.adventures a
LEFT JOIN public.itineraries i ON i.legacy_adventure_id = a.id AND i.user_id = a.user_id
GROUP BY a.user_id
HAVING COUNT(DISTINCT a.id) != COUNT(DISTINCT i.legacy_adventure_id);
-- (Expected Return: 0 rows)

-- 3. Cross-User Search Session Validation in Saved Activities
SELECT sa.id
FROM public.saved_activities sa
JOIN public.search_sessions ss ON sa.search_session_id = ss.id
WHERE sa.user_id != ss.user_id;
-- (Expected Return: 0 rows)

-- 4. Deep Isolation Intent Tracking Parity Breach check
SELECT bo.id
FROM public.booking_outcomes bo
JOIN public.booking_intents bi ON bo.booking_intent_id = bi.id
WHERE bo.user_id != bi.user_id;
-- (Expected Return: 0 rows)

-- 5. Detect Orphan Formulated Route Stops
SELECT ii.id
FROM public.itinerary_items ii
LEFT JOIN public.itineraries i ON i.id = ii.itinerary_id
WHERE i.id IS NULL;
-- (Expected Return: 0 rows)
