BEGIN;

-- 1. ENUMS (Isolated Idempotent Creation)
DO $$ BEGIN CREATE TYPE public.activity_source AS ENUM ('google_places', 'foursquare', 'viator', 'manual'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.activity_status AS ENUM ('active', 'hidden', 'deprecated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.activity_price_tier AS ENUM ('free', 'budget', 'mid', 'premium', 'unknown'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.booking_intent_status AS ENUM ('initiated', 'provider_redirected', 'abandoned', 'confirmed', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.booking_outcome_status AS ENUM ('booked', 'cancelled', 'refunded', 'attended', 'no_show'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.itinerary_status AS ENUM ('draft', 'ready', 'in_progress', 'completed', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. TABLES AND CONSTRAINTS
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    preferred_categories text[] DEFAULT '{}'::text[],
    preferred_price_tiers public.activity_price_tier[] DEFAULT '{}',
    accessibility_requirements text[] DEFAULT '{}'::text[],
    home_city text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(profile_id)
);

CREATE TABLE IF NOT EXISTS public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_key text UNIQUE NOT NULL,
    title text NOT NULL,
    summary text,
    categories text[] DEFAULT '{}'::text[],
    tags text[] DEFAULT '{}'::text[],
    source_priority public.activity_source NOT NULL DEFAULT 'manual',
    status public.activity_status NOT NULL DEFAULT 'active',
    location_city text,
    location_region text,
    location_country_code text,
    location_address_line text,
    location_lat double precision,
    location_lng double precision,
    location_timezone text,
    pricing_tier public.activity_price_tier DEFAULT 'unknown',
    pricing_from_minor integer,
    pricing_to_minor integer,
    pricing_currency text DEFAULT 'USD',
    pricing_is_free boolean DEFAULT false,
    duration_minutes_min integer,
    duration_minutes_max integer,
    rating_average numeric(3,2),
    rating_count integer,
    review_provider public.activity_source,
    image_url text,
    booking_supported boolean DEFAULT false,
    booking_deep_link text,
    accessibility_tags text[] DEFAULT '{}'::text[],
    family_friendly boolean,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name public.activity_source UNIQUE NOT NULL,
    api_base_url text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.activity_provider_refs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    provider public.activity_source NOT NULL,
    provider_ref text NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamptz DEFAULT now(),
    UNIQUE(provider, provider_ref)
);

CREATE TABLE IF NOT EXISTS public.search_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    result_count integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
    search_session_id uuid REFERENCES public.search_sessions(id) ON DELETE SET NULL,
    event_name text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    source_context text CHECK (source_context IN ('list', 'map', 'details', 'collection')),
    search_session_id uuid REFERENCES public.search_sessions(id) ON DELETE SET NULL,
    notes text,
    saved_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, activity_id)
);

CREATE TABLE IF NOT EXISTS public.itineraries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    destination_city text NOT NULL,
    start_date date,
    end_date date,
    status public.itinerary_status NOT NULL DEFAULT 'draft',
    legacy_adventure_id text UNIQUE, 
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.itinerary_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id uuid NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
    activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
    day_index integer NOT NULL DEFAULT 0,
    position_index integer NOT NULL DEFAULT 0,
    narrative_why text,
    scheduled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(itinerary_id, day_index, position_index)
);

CREATE TABLE IF NOT EXISTS public.booking_intents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    itinerary_id uuid REFERENCES public.itineraries(id) ON DELETE SET NULL,
    itinerary_item_id uuid REFERENCES public.itinerary_items(id) ON DELETE SET NULL,
    activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
    provider public.activity_source NOT NULL,
    status public.booking_intent_status NOT NULL DEFAULT 'initiated',
    provider_url text,
    started_at timestamptz NOT NULL DEFAULT now(),
    last_transition_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_outcomes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_intent_id uuid UNIQUE NOT NULL REFERENCES public.booking_intents(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status public.booking_outcome_status NOT NULL DEFAULT 'booked',
    provider_confirmation_ref text,
    booked_for_start_at timestamptz,
    total_minor integer,
    currency text DEFAULT 'USD',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_activities_source_updated ON public.activities(source_priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_sessions_user_created ON public.search_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_composite ON public.activity_events(user_id, event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_activity ON public.activity_events(activity_id);
CREATE INDEX IF NOT EXISTS idx_saved_activities_user_date ON public.saved_activities(user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_itineraries_user_updated ON public.itineraries(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_activity ON public.itinerary_items(activity_id);
CREATE INDEX IF NOT EXISTS idx_booking_intents_user ON public.booking_intents(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_intents_activity_provider ON public.booking_intents(activity_id, provider);
CREATE INDEX IF NOT EXISTS idx_booking_outcomes_user_created ON public.booking_outcomes(user_id, created_at DESC);

-- 4. TRIGGERS
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    AND table_name IN ('user_preferences', 'activities', 'itineraries', 'itinerary_items', 'booking_outcomes')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS touch_%I_updated_at ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER touch_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t, t);
    END LOOP;
END $$;

COMMIT;
