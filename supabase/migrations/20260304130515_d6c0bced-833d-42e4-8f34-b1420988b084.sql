
CREATE OR REPLACE FUNCTION public.check_and_consume_quota(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_result JSONB;
BEGIN
  -- Buscar assinatura ativa OU em trial do usuário
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status IN ('ACTIVE', 'TRIALING')
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se não tem assinatura ativa/trial
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

  -- Se é plano STARTER (ou trial com créditos)
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
$function$;

CREATE OR REPLACE FUNCTION public.get_quota_status(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status IN ('ACTIVE', 'TRIALING')
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
$function$;
