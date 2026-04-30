BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'passport_stamp_art_manifest'
      AND column_name = 'image_path'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.passport_stamp_art_manifest
      ALTER COLUMN image_path DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'passport_stamp_art_manifest'
      AND column_name = 'locked_image_path'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.passport_stamp_art_manifest
      ALTER COLUMN locked_image_path DROP NOT NULL;
  END IF;
END
$$;

COMMIT;
