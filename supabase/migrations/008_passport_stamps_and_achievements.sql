BEGIN;

CREATE TABLE IF NOT EXISTS public.passport_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  itinerary_id uuid REFERENCES public.itineraries(id) ON DELETE SET NULL,
  day_index integer NOT NULL DEFAULT 1 CHECK (day_index >= 1),
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  place_id text NOT NULL,
  canonical_key text,
  title text NOT NULL DEFAULT 'Stop',
  city text,
  country_code text,
  lat double precision,
  lng double precision,
  source text NOT NULL DEFAULT 'proximity_auto' CHECK (source IN ('proximity_auto')),
  distance_meters numeric(8,2),
  day_total_stops integer,
  day_stamped_count_at_stamp integer,
  stamped_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, place_id)
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  unlocked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS passport_stamps_user_stamped_at_idx
  ON public.passport_stamps(user_id, stamped_at DESC);

CREATE INDEX IF NOT EXISTS passport_stamps_user_country_idx
  ON public.passport_stamps(user_id, country_code);

CREATE INDEX IF NOT EXISTS passport_stamps_user_itinerary_day_idx
  ON public.passport_stamps(user_id, itinerary_id, day_index, stamped_at DESC);

CREATE INDEX IF NOT EXISTS user_achievements_user_unlocked_idx
  ON public.user_achievements(user_id, unlocked_at DESC);

ALTER TABLE public.passport_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own passport stamps" ON public.passport_stamps;
DROP POLICY IF EXISTS "Manage own achievements" ON public.user_achievements;

CREATE POLICY "Manage own passport stamps" ON public.passport_stamps
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manage own achievements" ON public.user_achievements
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
