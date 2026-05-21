CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.encrypt_cpf(cpf_plain TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN cpf_plain IS NULL OR cpf_plain = '' THEN NULL
    ELSE encode(extensions.digest(cpf_plain, 'sha256'), 'hex')
  END;
$$;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf_hash TEXT
  GENERATED ALWAYS AS (public.encrypt_cpf(cpf)) STORED;

ALTER TABLE public.teleconsultas
  ADD COLUMN IF NOT EXISTS patient_cpf_hash TEXT
  GENERATED ALWAYS AS (public.encrypt_cpf(patient_cpf)) STORED;

CREATE INDEX IF NOT EXISTS patients_cpf_hash_idx ON public.patients(cpf_hash);
CREATE INDEX IF NOT EXISTS teleconsultas_cpf_hash_idx ON public.teleconsultas(patient_cpf_hash);

COMMENT ON COLUMN public.patients.cpf_hash IS 'SHA-256 do CPF para busca segura. O CPF original deve ser migrado para campo criptografado em fase 2.';
COMMENT ON COLUMN public.teleconsultas.patient_cpf_hash IS 'SHA-256 do CPF do paciente para busca segura.';