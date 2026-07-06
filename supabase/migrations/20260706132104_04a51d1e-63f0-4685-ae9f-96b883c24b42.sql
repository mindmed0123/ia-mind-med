
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS laudo_id uuid REFERENCES public.laudos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'final',
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_status_check;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_status_check CHECK (status IN ('rascunho_ia','final'));

CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_laudo_id_unique
  ON public.prescriptions(laudo_id)
  WHERE laudo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS prescriptions_status_idx
  ON public.prescriptions(status);
