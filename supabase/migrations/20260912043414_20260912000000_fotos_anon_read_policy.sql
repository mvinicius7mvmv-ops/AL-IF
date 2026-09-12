-- ============================================================
-- Restore public read access on the `fotos` bucket
-- ============================================================
-- The bucket is public (public=true), so public URLs are used
-- for player photos, opponent logos, sponsor logos, etc.
-- The security audit migration removed the original fotos_public_read
-- policy, leaving only fotos_authenticated_read. This caused public
-- (anon) requests to Storage to fail with 403, breaking image display
-- for unauthenticated visitors and causing render errors when <img>
-- tags received non-image error responses.
--
-- This restores anon SELECT on the bucket so public URLs resolve.
-- Write policies (INSERT/UPDATE/DELETE) remain authenticated-only.

DROP POLICY IF EXISTS "fotos_anon_read" ON storage.objects;
CREATE POLICY "fotos_anon_read" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'fotos');
