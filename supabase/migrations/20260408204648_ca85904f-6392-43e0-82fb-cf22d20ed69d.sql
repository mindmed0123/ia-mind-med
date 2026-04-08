-- Index for fast patient name search (trigram-based for ilike)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_patients_name_trgm 
ON public.patients USING gin (name gin_trgm_ops);

-- Index for user_id filter
CREATE INDEX IF NOT EXISTS idx_patients_user_id 
ON public.patients (user_id);
