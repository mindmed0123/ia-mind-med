
-- Add clinical data columns to patients table
ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS medications text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS comorbidities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chief_complaint text,
  ADD COLUMN IF NOT EXISTS clinical_history text,
  ADD COLUMN IF NOT EXISTS family_history text,
  ADD COLUMN IF NOT EXISTS smoking boolean,
  ADD COLUMN IF NOT EXISTS alcohol boolean,
  ADD COLUMN IF NOT EXISTS clinical_notes text,
  ADD COLUMN IF NOT EXISTS ai_extracted_fields text[] DEFAULT '{}';
