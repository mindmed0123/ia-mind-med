-- Bucket profile-images: RLS policies for authenticated user ownership + service-role admin access
CREATE POLICY "Users can view their own profile images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role can manage all profile images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'profile-images')
WITH CHECK (bucket_id = 'profile-images');
