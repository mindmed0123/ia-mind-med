-- Atualizar tabela profiles para incluir dados do médico
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS crm_uf TEXT,
  ADD COLUMN IF NOT EXISTS clinic_name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email_public TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS stamp_image_url TEXT,
  ADD COLUMN IF NOT EXISTS prescription_footer_text TEXT DEFAULT 'Uso conforme orientação médica. Não se automedique.';

-- Criar tabela de receituários
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_dob DATE,
  patient_sex TEXT,
  patient_id_external TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{medicamento, dosagem, posologia, duracao, observacoes}]
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id ON public.prescriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON public.prescriptions(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para prescriptions
CREATE POLICY "Usuários podem ver seus próprios receituários"
  ON public.prescriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios receituários"
  ON public.prescriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios receituários"
  ON public.prescriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios receituários"
  ON public.prescriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at em prescriptions
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Adicionar campos ao laudos para melhor controle de PDF
ALTER TABLE public.laudos
  ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pdf_version INTEGER DEFAULT 1;

-- Criar índice para busca de laudos por PDF
CREATE INDEX IF NOT EXISTS idx_laudos_pdf_url ON public.laudos(pdf_url) WHERE pdf_url IS NOT NULL;