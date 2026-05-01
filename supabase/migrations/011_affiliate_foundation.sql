BEGIN;

DO $$ BEGIN
  CREATE TYPE public.affiliate_partner_status AS ENUM ('active', 'paused', 'retired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliate_offer_status AS ENUM ('active', 'paused', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliate_commission_model AS ENUM ('cpa', 'rev_share', 'flat');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliate_placement_surface AS ENUM ('explore_card', 'details_primary_cta', 'journeys_stop_cta');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliate_attribution_status AS ENUM ('candidate', 'attributed', 'expired', 'superseded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliate_payout_status AS ENUM ('reported', 'confirmed', 'rejected', 'reversed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliate_event_name AS ENUM (
    'affiliate_impression',
    'affiliate_click',
    'affiliate_handoff_started',
    'affiliate_handoff_returned',
    'affiliate_booking_reported',
    'affiliate_commission_confirmed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  status public.affiliate_partner_status NOT NULL DEFAULT 'paused',
  disclosure_label text NOT NULL DEFAULT 'Partner offer',
  default_commission_model public.affiliate_commission_model NOT NULL DEFAULT 'cpa',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  provider_ref text NOT NULL,
  title text NOT NULL,
  status public.affiliate_offer_status NOT NULL DEFAULT 'paused',
  commission_model public.affiliate_commission_model NOT NULL DEFAULT 'cpa',
  commission_value numeric(10,4),
  currency_code text,
  destination_scope text[] NOT NULL DEFAULT '{}'::text[],
  category_scope text[] NOT NULL DEFAULT '{}'::text[],
  tracking_template text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_offers_valid_window_check CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT affiliate_offers_partner_ref_unique UNIQUE (partner_id, provider_ref)
);

CREATE TABLE IF NOT EXISTS public.affiliate_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface public.affiliate_placement_surface NOT NULL,
  placement_key text UNIQUE NOT NULL,
  disclosure_required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name public.affiliate_event_name NOT NULL DEFAULT 'affiliate_click',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_id text,
  session_id text NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL REFERENCES public.affiliate_offers(id) ON DELETE RESTRICT,
  partner_id uuid NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  placement_id uuid NOT NULL REFERENCES public.affiliate_placements(id) ON DELETE RESTRICT,
  attribution_status public.affiliate_attribution_status NOT NULL DEFAULT 'candidate',
  click_ts timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deduped boolean NOT NULL DEFAULT false,
  source_surface text NOT NULL,
  placement_key text NOT NULL,
  copy_variant text,
  partner_brand text,
  disclosure_wording text,
  destination_city text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_attributions_actor_check CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL),
  CONSTRAINT affiliate_attributions_expiry_check CHECK (expires_at > click_ts)
);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES public.affiliate_offers(id) ON DELETE SET NULL,
  attribution_id uuid REFERENCES public.affiliate_attributions(id) ON DELETE SET NULL,
  external_booking_ref text,
  payout_status public.affiliate_payout_status NOT NULL,
  commission_amount numeric(12,2),
  currency_code text,
  event_ts timestamptz NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_offers_partner_status_valid_from
  ON public.affiliate_offers(partner_id, status, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_offers_status_valid_to
  ON public.affiliate_offers(status, valid_to);

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_user_click_ts
  ON public.affiliate_attributions(user_id, click_ts DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_guest_click_ts
  ON public.affiliate_attributions(guest_id, click_ts DESC)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_partner_placement_click_ts
  ON public.affiliate_attributions(partner_id, placement_id, click_ts DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_partner_offer_placement_copy
  ON public.affiliate_attributions(partner_id, offer_id, placement_key, copy_variant, click_ts DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_dedupe_user
  ON public.affiliate_attributions(user_id, offer_id, activity_id, source_surface, click_ts DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_dedupe_guest
  ON public.affiliate_attributions(guest_id, offer_id, activity_id, source_surface, click_ts DESC)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_payout_events_partner_event_ts
  ON public.affiliate_payout_events(partner_id, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_payout_events_status_event_ts
  ON public.affiliate_payout_events(payout_status, event_ts DESC);

ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read affiliate partners" ON public.affiliate_partners;
DROP POLICY IF EXISTS "Read affiliate offers" ON public.affiliate_offers;
DROP POLICY IF EXISTS "Read affiliate placements" ON public.affiliate_placements;
DROP POLICY IF EXISTS "Read own affiliate attributions" ON public.affiliate_attributions;

CREATE POLICY "Read affiliate partners" ON public.affiliate_partners
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Read affiliate offers" ON public.affiliate_offers
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Read affiliate placements" ON public.affiliate_placements
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Read own affiliate attributions" ON public.affiliate_attributions
  FOR SELECT
  USING (user_id = auth.uid());

DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS touch_affiliate_partners_updated_at ON public.affiliate_partners';
  EXECUTE 'CREATE TRIGGER touch_affiliate_partners_updated_at BEFORE UPDATE ON public.affiliate_partners FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()';
  EXECUTE 'DROP TRIGGER IF EXISTS touch_affiliate_offers_updated_at ON public.affiliate_offers';
  EXECUTE 'CREATE TRIGGER touch_affiliate_offers_updated_at BEFORE UPDATE ON public.affiliate_offers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()';
END $$;

COMMIT;

