-- Add structured fields to laudos table for AI-generated reports
ALTER TABLE public.laudos
ADD COLUMN IF NOT EXISTS patient_data jsonb,
ADD COLUMN IF NOT EXISTS clinical_context jsonb,
ADD COLUMN IF NOT EXISTS hypotheses jsonb,
ADD COLUMN IF NOT EXISTS conducts jsonb,
ADD COLUMN IF NOT EXISTS complementary_exams jsonb,
ADD COLUMN IF NOT EXISTS red_flags jsonb,
ADD COLUMN IF NOT EXISTS cid10_codes jsonb,
ADD COLUMN IF NOT EXISTS report_markdown text,
ADD COLUMN IF NOT EXISTS patient_markdown text,
ADD COLUMN IF NOT EXISTS legal_disclaimer text,
ADD COLUMN IF NOT EXISTS ai_model text,
ADD COLUMN IF NOT EXISTS ai_usage jsonb;