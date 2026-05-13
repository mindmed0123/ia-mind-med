
CREATE TABLE public.triagens_hantavirus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  sintomas JSONB NOT NULL DEFAULT '{}'::jsonb,
  fatores_epidemiologicos JSONB NOT NULL DEFAULT '{}'::jsonb,
  descricao_sintomas TEXT,
  imagens_manchas TEXT[] NOT NULL DEFAULT '{}',
  probabilidade_hantavirus INTEGER,
  classificacao_risco TEXT CHECK (classificacao_risco IN ('baixo','moderado','alto','critico')),
  analise_ia TEXT,
  recomendacoes_ia TEXT[],
  analise_imagem_ia TEXT,
  diferenciais_ia TEXT[],
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido','salvo_prontuario')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

CREATE INDEX idx_triagens_hantavirus_org ON public.triagens_hantavirus(organization_id);
CREATE INDEX idx_triagens_hantavirus_doctor ON public.triagens_hantavirus(doctor_id);
CREATE INDEX idx_triagens_hantavirus_patient ON public.triagens_hantavirus(patient_id);
CREATE INDEX idx_triagens_hantavirus_risco ON public.triagens_hantavirus(classificacao_risco);
CREATE INDEX idx_triagens_hantavirus_created ON public.triagens_hantavirus(created_at DESC);

ALTER TABLE public.triagens_hantavirus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_manage_triagens_hantavirus"
  ON public.triagens_hantavirus FOR ALL
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.update_triagem_hantavirus_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER triagens_hantavirus_updated_at
  BEFORE UPDATE ON public.triagens_hantavirus
  FOR EACH ROW EXECUTE FUNCTION public.update_triagem_hantavirus_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('hantavirus-imagens', 'hantavirus-imagens', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hantavirus_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hantavirus-imagens');

CREATE POLICY "hantavirus_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'hantavirus-imagens');

CREATE POLICY "hantavirus_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hantavirus-imagens');
