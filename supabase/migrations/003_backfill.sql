BEGIN;

-- 1. Safely hydrate User Preferences via core Profile data boundary limits
INSERT INTO public.user_preferences (profile_id, created_at, home_city)
SELECT id, created_at, home_city FROM public.profiles
ON CONFLICT (profile_id) DO NOTHING;

-- 2. Backfill Itineraries via safe ON CONFLICT mappings
INSERT INTO public.itineraries (
    user_id, title, destination_city, status, legacy_adventure_id, created_at, updated_at
)
SELECT 
    user_id, 
    title, 
    'Unknown Destination', 
    CASE 
        WHEN status = 'active' THEN 'in_progress'::public.itinerary_status
        WHEN status = 'completed' THEN 'completed'::public.itinerary_status
        ELSE 'draft'::public.itinerary_status
    END,
    id, 
    created_at,
    timezone('utc', now())
FROM public.adventures
WHERE user_id IS NOT NULL
ON CONFLICT (legacy_adventure_id) DO NOTHING;

-- 3. Discover generic primitives explicitly with ORDINALITY array enumeration 
INSERT INTO public.activities (canonical_key, title, source_priority, status)
SELECT DISTINCT 
    (stop->>'place_id') as canonical_key,
    COALESCE(stop->>'name', 'Unknown Activity') as title,
    'google_places'::public.activity_source as source_priority,
    'active'::public.activity_status as status
FROM public.adventure_days ad
CROSS JOIN LATERAL jsonb_array_elements(ad.itinerary_json) WITH ORDINALITY AS arr(stop, ord)
WHERE jsonb_typeof(ad.itinerary_json) = 'array'
  AND (stop->>'place_id') IS NOT NULL
ON CONFLICT (canonical_key) DO NOTHING;

-- 4. Cross-Map elements completely deterministically employing ordinal fallbacks guarding position unique restrictions 
INSERT INTO public.itinerary_items (itinerary_id, activity_id, day_index, position_index, narrative_why)
SELECT 
    i.id,
    act.id,
    ad.day_number,
    CASE 
        WHEN (stop->>'position') ~ '^[0-9]+$' THEN (stop->>'position')::int
        ELSE ord::int
    END as position_index,
    ad.theme_title
FROM public.adventure_days ad
JOIN public.itineraries i ON i.legacy_adventure_id = ad.adventure_id
CROSS JOIN LATERAL jsonb_array_elements(ad.itinerary_json) WITH ORDINALITY AS arr(stop, ord)
JOIN public.activities act ON act.canonical_key = (stop->>'place_id')
WHERE jsonb_typeof(ad.itinerary_json) = 'array'
ON CONFLICT (itinerary_id, day_index, position_index) DO NOTHING;

COMMIT;
