-- Remove laudos from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.laudos;

-- Add UPDATE policy for patient-documents storage bucket
CREATE POLICY "Users can update their own documents"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'patient-documents' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'patient-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);