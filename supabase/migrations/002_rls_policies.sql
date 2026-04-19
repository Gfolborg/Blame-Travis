BEGIN;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_outcomes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_provider_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activities are globally readable" ON public.activities;
DROP POLICY IF EXISTS "Activity Sources are globally readable" ON public.activity_sources;
DROP POLICY IF EXISTS "Activity Provider Refs are globally readable" ON public.activity_provider_refs;
DROP POLICY IF EXISTS "Manage own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Manage own search sessions" ON public.search_sessions;
DROP POLICY IF EXISTS "Manage own activity events" ON public.activity_events;
DROP POLICY IF EXISTS "Manage own saved activities" ON public.saved_activities;
DROP POLICY IF EXISTS "Manage own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Manage own itinerary items" ON public.itinerary_items;
DROP POLICY IF EXISTS "Manage own booking intents" ON public.booking_intents;
DROP POLICY IF EXISTS "Manage own booking outcomes" ON public.booking_outcomes;

CREATE POLICY "Activities are globally readable" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Activity Sources are globally readable" ON public.activity_sources FOR SELECT USING (true);
CREATE POLICY "Activity Provider Refs are globally readable" ON public.activity_provider_refs FOR SELECT USING (true);

-- User-Bound RLS Exposing Cross-table Hardened Ownership validation per spec
CREATE POLICY "Manage own preferences" ON public.user_preferences
    FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Manage own search sessions" ON public.search_sessions
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manage own activity events" ON public.activity_events
    FOR ALL USING (user_id = auth.uid()) 
    WITH CHECK (
        user_id = auth.uid() AND
        (search_session_id IS NULL OR EXISTS (
            SELECT 1 FROM public.search_sessions 
            WHERE id = search_session_id AND user_id = auth.uid()
        ))
    );

CREATE POLICY "Manage own saved activities" ON public.saved_activities
    FOR ALL USING (user_id = auth.uid()) 
    WITH CHECK (
        user_id = auth.uid() AND
        (search_session_id IS NULL OR EXISTS (
            SELECT 1 FROM public.search_sessions 
            WHERE id = search_session_id AND user_id = auth.uid()
        ))
    );

CREATE POLICY "Manage own itineraries" ON public.itineraries
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manage own itinerary items" ON public.itinerary_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.itineraries 
            WHERE itineraries.id = itinerary_items.itinerary_id AND itineraries.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.itineraries 
            WHERE itineraries.id = itinerary_items.itinerary_id AND itineraries.user_id = auth.uid()
        )
    );

CREATE POLICY "Manage own booking intents" ON public.booking_intents
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manage own booking outcomes" ON public.booking_outcomes
    FOR ALL USING (user_id = auth.uid()) 
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.booking_intents 
            WHERE id = booking_intent_id AND user_id = auth.uid()
        )
    );

COMMIT;
