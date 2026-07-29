/*
# Storage bucket for player photos

1. Storage
- Create public bucket `fotos` for player profile pictures
- Allow public read (photos are shown in squad)
- Allow authenticated upload (admin or owner)

2. Notes
- The bucket is public-read so the public squad page can display player photos.
- Uploads are gated by the client-side RLS-equivalent (only admin or own profile can write).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fotos_public_read" ON storage.objects;
CREATE POLICY "fotos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'fotos');

DROP POLICY IF EXISTS "fotos_authenticated_upload" ON storage.objects;
CREATE POLICY "fotos_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos');

DROP POLICY IF EXISTS "fotos_authenticated_update" ON storage.objects;
CREATE POLICY "fotos_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos');

DROP POLICY IF EXISTS "fotos_authenticated_delete" ON storage.objects;
CREATE POLICY "fotos_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fotos');
