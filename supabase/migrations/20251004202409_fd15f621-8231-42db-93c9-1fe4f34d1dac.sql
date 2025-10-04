-- Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  diff JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para audit_logs
CREATE POLICY "Usuários podem ver seus próprios logs"
  ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Atualizar tabela laudos com novos campos
ALTER TABLE public.laudos 
  ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS diagnosis_main TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_diff TEXT,
  ADD COLUMN IF NOT EXISTS pdf_hash TEXT,
  ADD COLUMN IF NOT EXISTS pdf_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS editor_last_saved TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- Criar função para registrar ações de auditoria
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_entity TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_diff JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    entity,
    entity_id,
    user_id,
    action,
    diff
  )
  VALUES (
    p_entity,
    p_entity_id,
    auth.uid(),
    p_action,
    p_diff
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Criar trigger para autosave
CREATE OR REPLACE FUNCTION public.handle_laudo_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar timestamp de último save
  NEW.editor_last_saved = now();
  
  -- Se status mudou para FINAL, registrar timestamp
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.finalized_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_laudo_update ON public.laudos;
CREATE TRIGGER trigger_laudo_update
  BEFORE UPDATE ON public.laudos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_laudo_update();

-- Comentários para documentação
COMMENT ON TABLE public.audit_logs IS 'Registros de auditoria para ações no sistema (LGPD)';
COMMENT ON COLUMN public.laudos.sections IS 'Seções estruturadas do laudo (JSON com identificacao, queixa, hda, exame_fisico, hipoteses, conduta, cid10)';
COMMENT ON COLUMN public.laudos.pdf_hash IS 'Hash SHA-256 do PDF para verificação';
COMMENT ON COLUMN public.laudos.pdf_verify_token IS 'Token JWT para verificação pública do PDF';