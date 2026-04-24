ALTER TABLE public.patient_documents
ADD COLUMN IF NOT EXISTS medical_observation text;