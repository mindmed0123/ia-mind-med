ALTER TABLE public.laudos DROP CONSTRAINT IF EXISTS laudos_audio_processing_status_check;
ALTER TABLE public.laudos ADD CONSTRAINT laudos_audio_processing_status_check
  CHECK (audio_processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'error'::text]));