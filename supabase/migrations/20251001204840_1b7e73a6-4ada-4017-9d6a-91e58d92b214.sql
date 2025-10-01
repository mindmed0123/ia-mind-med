-- Storage policies for private bucket 'audio-files'
-- Drop existing policies if they exist (safe cleanup)
DROP POLICY IF EXISTS "Users can read their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;

-- Allow users to read their own files in audio-files
CREATE POLICY "Users can read their own audio files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to upload files to a folder that matches their user id
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to update (e.g., replace) files they own
CREATE POLICY "Users can update their own audio files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete files they own
CREATE POLICY "Users can delete their own audio files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );