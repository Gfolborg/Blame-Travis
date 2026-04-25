BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_activities_status_updated
  ON public.activities(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_title_trgm_active
  ON public.activities USING gin (title gin_trgm_ops)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_activities_city_trgm_active
  ON public.activities USING gin (location_city gin_trgm_ops)
  WHERE status = 'active' AND location_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_region_trgm_active
  ON public.activities USING gin (location_region gin_trgm_ops)
  WHERE status = 'active' AND location_region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_lat_lng_active
  ON public.activities(location_lat, location_lng)
  WHERE status = 'active' AND location_lat IS NOT NULL AND location_lng IS NOT NULL;

COMMIT;
