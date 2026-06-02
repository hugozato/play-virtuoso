
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Public read by direct URL only (no listing via path-based filter)
CREATE POLICY "Avatar images readable by anyone via URL"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);
