
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS cpf TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS patients_user_cpf_unique
  ON public.patients(user_id, cpf) WHERE cpf IS NOT NULL;

ALTER TABLE public.triagens_hantavirus ADD COLUMN IF NOT EXISTS patient_cpf TEXT;
CREATE INDEX IF NOT EXISTS triagens_hantavirus_patient_id_idx
  ON public.triagens_hantavirus(patient_id);
