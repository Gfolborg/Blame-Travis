BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adventure_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Manage own adventures" ON public.adventures;
DROP POLICY IF EXISTS "Manage own adventure days" ON public.adventure_days;
DROP POLICY IF EXISTS "Manage own notification devices" ON public.notification_devices;
DROP POLICY IF EXISTS "Manage own notification deliveries" ON public.notification_deliveries;

CREATE POLICY "Manage own profile" ON public.profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Manage own adventures" ON public.adventures
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manage own adventure days" ON public.adventure_days
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.adventures a
      WHERE a.id = adventure_days.adventure_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.adventures a
      WHERE a.id = adventure_days.adventure_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Manage own notification devices" ON public.notification_devices
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Manage own notification deliveries" ON public.notification_deliveries
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (
    profile_id = auth.uid()
    AND (
      adventure_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.adventures a
        WHERE a.id = notification_deliveries.adventure_id
          AND a.user_id = auth.uid()
      )
    )
  );

COMMIT;
