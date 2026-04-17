ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.adventures
  ADD COLUMN IF NOT EXISTS main_goal text,
  ADD COLUMN IF NOT EXISTS bonus_goal text;

CREATE TABLE IF NOT EXISTS public.notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  install_id text NOT NULL UNIQUE,
  expo_push_token text,
  platform text NOT NULL,
  permission_status text NOT NULL DEFAULT 'undetermined',
  app_version text,
  last_seen_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  adventure_id text REFERENCES public.adventures(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL UNIQUE,
  type text NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  opened_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS notification_devices_profile_id_idx
  ON public.notification_devices(profile_id);

CREATE INDEX IF NOT EXISTS notification_deliveries_profile_id_idx
  ON public.notification_deliveries(profile_id);

CREATE INDEX IF NOT EXISTS notification_deliveries_adventure_id_idx
  ON public.notification_deliveries(adventure_id);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx
  ON public.notification_deliveries(status, scheduled_for);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_notification_devices_updated_at ON public.notification_devices;
CREATE TRIGGER touch_notification_devices_updated_at
BEFORE UPDATE ON public.notification_devices
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_notification_deliveries_updated_at ON public.notification_deliveries;
CREATE TRIGGER touch_notification_deliveries_updated_at
BEFORE UPDATE ON public.notification_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();
