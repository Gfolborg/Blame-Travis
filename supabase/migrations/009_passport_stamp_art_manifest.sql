BEGIN;

CREATE TABLE IF NOT EXISTS public.passport_stamp_art_manifest (
  achievement_key text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  storage_path text NOT NULL,
  locked_storage_path text,
  theme_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.passport_stamp_art_manifest
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS locked_storage_path text,
  ADD COLUMN IF NOT EXISTS theme_metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

UPDATE public.passport_stamp_art_manifest
SET
  version = COALESCE(version, 1),
  theme_metadata = COALESCE(theme_metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'passport_stamp_art_manifest'
      AND column_name = 'image_path'
  ) THEN
    EXECUTE $legacy$
      UPDATE public.passport_stamp_art_manifest
      SET storage_path = COALESCE(
        storage_path,
        NULLIF(
          regexp_replace(
            image_path,
            '^https?://[^/]+/storage/v1/object/public/passport-stamps/',
            ''
          ),
          ''
        ),
        image_path
      )
      WHERE image_path IS NOT NULL
    $legacy$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'passport_stamp_art_manifest'
      AND column_name = 'locked_image_path'
  ) THEN
    EXECUTE $legacy$
      UPDATE public.passport_stamp_art_manifest
      SET locked_storage_path = COALESCE(
        locked_storage_path,
        NULLIF(
          regexp_replace(
            locked_image_path,
            '^https?://[^/]+/storage/v1/object/public/passport-stamps/',
            ''
          ),
          ''
        ),
        locked_image_path
      )
      WHERE locked_image_path IS NOT NULL
    $legacy$;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS passport_stamp_art_manifest_updated_at_idx
  ON public.passport_stamp_art_manifest(updated_at DESC);

ALTER TABLE public.passport_stamp_art_manifest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Passport stamp art is publicly readable" ON public.passport_stamp_art_manifest;

CREATE POLICY "Passport stamp art is publicly readable" ON public.passport_stamp_art_manifest
  FOR SELECT
  USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'passport-stamps',
  'passport-stamps',
  true,
  5242880,
  ARRAY['image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Passport stamp assets are publicly readable" ON storage.objects;

CREATE POLICY "Passport stamp assets are publicly readable" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'passport-stamps');

COMMIT;
