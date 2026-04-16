-- 1. Add hero image column to adventures
ALTER TABLE public.adventures ADD COLUMN IF NOT EXISTS hero_image_url text;

-- 2. Create the storage bucket for hero images (if not exists)
insert into storage.buckets (id, name, public)
values ('adventure-heros', 'adventure-heros', true)
on conflict (id) do nothing;

-- 3. Storage Policies (Allow public read, authenticated upload)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Hero images are public' 
        AND tablename = 'objects' 
        AND schemaname = 'storage'
    ) THEN
        create policy "Hero images are public" on storage.objects
          for select using (bucket_id = 'adventure-heros');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Service role can manage hero images' 
        AND tablename = 'objects' 
        AND schemaname = 'storage'
    ) THEN
        create policy "Service role can manage hero images" on storage.objects
          for all using (bucket_id = 'adventure-heros');
    END IF;
END $$;
