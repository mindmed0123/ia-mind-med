-- Criar tabela de logs de consentimento LGPD específicos
CREATE TABLE IF NOT EXISTS public.consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- 'audio_processing', 'data_storage', etc
  version TEXT NOT NULL, -- versão dos termos aceitos
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para consent_logs
CREATE POLICY "Usuários podem ver seus próprios consentimentos"
  ON public.consent_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios consentimentos"
  ON public.consent_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Não permitir updates ou deletes de consentimentos (auditoria)
CREATE POLICY "Consentimentos não podem ser atualizados"
  ON public.consent_logs FOR UPDATE
  USING (false);

CREATE POLICY "Consentimentos não podem ser deletados"
  ON public.consent_logs FOR DELETE
  USING (false);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON public.consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_consent_type ON public.consent_logs(consent_type);

-- Atualizar tabela subscriptions para garantir campos corretos
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS quota_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'cakto';

-- Adicionar índice para busca por external_payment_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_external_payment_id 
  ON public.subscriptions(external_payment_id);

-- Função para verificar e consumir quota
CREATE OR REPLACE FUNCTION public.check_and_consume_quota(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_result JSONB;
BEGIN
  -- Buscar assinatura ativa do usuário
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status = 'ACTIVE'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se não tem assinatura ativa
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'no_active_subscription',
      'remaining', 0
    );
  END IF;

  -- Se é plano PRO (ilimitado)
  IF v_subscription.plan = 'PRO' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'plan', 'pro',
      'remaining', null,
      'unlimited', true
    );
  END IF;

  -- Se é plano STARTER
  IF v_subscription.plan = 'STARTER' THEN
    -- Verificar se ainda tem créditos
    IF v_subscription.remaining_starter_credits <= 0 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'quota_exceeded',
        'remaining', 0,
        'plan', 'starter'
      );
    END IF;

    -- Consumir um crédito
    UPDATE public.subscriptions
    SET 
      remaining_starter_credits = remaining_starter_credits - 1,
      quota_used = COALESCE(quota_used, 0) + 1,
      updated_at = NOW()
    WHERE id = v_subscription.id;

    RETURN jsonb_build_object(
      'allowed', true,
      'plan', 'starter',
      'remaining', v_subscription.remaining_starter_credits - 1,
      'unlimited', false
    );
  END IF;

  -- Fallback
  RETURN jsonb_build_object(
    'allowed', false,
    'reason', 'unknown_plan',
    'remaining', 0
  );
END;
$$;

-- Função para obter status de quota sem consumir
CREATE OR REPLACE FUNCTION public.get_quota_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status = 'ACTIVE'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'plan', null,
      'remaining', 0,
      'unlimited', false
    );
  END IF;

  IF v_subscription.plan = 'PRO' THEN
    RETURN jsonb_build_object(
      'has_subscription', true,
      'plan', 'pro',
      'remaining', null,
      'unlimited', true,
      'status', v_subscription.status
    );
  END IF;

  RETURN jsonb_build_object(
    'has_subscription', true,
    'plan', 'starter',
    'remaining', v_subscription.remaining_starter_credits,
    'used', COALESCE(v_subscription.quota_used, 0),
    'total', 10,
    'unlimited', false,
    'status', v_subscription.status
  );
END;
$$;