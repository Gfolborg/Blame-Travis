CREATE TABLE IF NOT EXISTS public.adventure_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.adventures(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  status text NOT NULL DEFAULT 'outline',
  theme_title text NOT NULL,
  teaser text,
  itinerary_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  outline_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_json jsonb,
  hydrated_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT adventure_days_adventure_day_unique UNIQUE (adventure_id, day_number)
);

CREATE INDEX IF NOT EXISTS adventure_days_adventure_id_idx
  ON public.adventure_days(adventure_id);

CREATE INDEX IF NOT EXISTS adventure_days_status_idx
  ON public.adventure_days(status);

DROP TRIGGER IF EXISTS touch_adventure_days_updated_at ON public.adventure_days;
CREATE TRIGGER touch_adventure_days_updated_at
BEFORE UPDATE ON public.adventure_days
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();
