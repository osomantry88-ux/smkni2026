-- Add foto_url column to siswa
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'foto_url') THEN
    ALTER TABLE public.siswa ADD COLUMN foto_url text;
  END IF;
END $$;

-- Add foto_url column to guru_tendik
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guru_tendik' AND column_name = 'foto_url') THEN
    ALTER TABLE public.guru_tendik ADD COLUMN foto_url text;
  END IF;
END $$;

-- Create storage bucket for profile photos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile-photos bucket
DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
CREATE POLICY "profile_photos_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_upload_authenticated" ON storage.objects;
CREATE POLICY "profile_photos_upload_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_update_authenticated" ON storage.objects;
CREATE POLICY "profile_photos_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'profile-photos')
  WITH CHECK (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_delete_authenticated" ON storage.objects;
CREATE POLICY "profile_photos_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'profile-photos');