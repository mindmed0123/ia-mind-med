-- Phase 2: Add receita classification to prescriptions
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS tipo_receita text DEFAULT 'branca_comum',
  ADD COLUMN IF NOT EXISTS group_id uuid;

COMMENT ON COLUMN public.prescriptions.tipo_receita IS 'branca_comum | controle_especial | azul_b | amarela_a | antimicrobiano';
COMMENT ON COLUMN public.prescriptions.group_id IS 'Groups multiple receitas issued together for the same consultation';

CREATE INDEX IF NOT EXISTS idx_prescriptions_group ON public.prescriptions(group_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_tipo ON public.prescriptions(tipo_receita);