-- Phase 2: Admin user 360 + audited management actions

-- 1) Audit logger (SECURITY DEFINER) — only admins can write
CREATE OR REPLACE FUNCTION public.admin_log_action(
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_diff jsonb DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.audit_logs(entity, entity_id, action, diff, ip, user_agent, user_id)
  VALUES (p_entity, p_entity_id, p_action, p_diff, p_ip, p_user_agent, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 2) 360º user profile (single round-trip)
CREATE OR REPLACE FUNCTION public.admin_user_360(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_sub jsonb;
  v_counts jsonb;
  v_recent_laudos jsonb;
  v_recent_audit jsonb;
  v_onboarding jsonb;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT to_jsonb(p) - 'lgpd_consent_ip'
    INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT to_jsonb(s) INTO v_sub
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id;

  SELECT jsonb_build_object(
    'laudos', (SELECT count(*) FROM public.laudos WHERE user_id = p_user_id),
    'prescriptions', (SELECT count(*) FROM public.prescriptions WHERE user_id = p_user_id),
    'patients', (SELECT count(*) FROM public.patients WHERE user_id = p_user_id),
    'teleconsultas', (SELECT count(*) FROM public.teleconsultas WHERE medico_id = p_user_id)
  ) INTO v_counts;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'status', status, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_recent_laudos
  FROM (
    SELECT id, title, status, created_at FROM public.laudos
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) l;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'action', action, 'entity', entity, 'diff', diff,
    'created_at', created_at, 'actor_id', user_id
  ) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_recent_audit
  FROM (
    SELECT id, action, entity, diff, created_at, user_id
    FROM public.audit_logs
    WHERE entity = 'user' AND entity_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) a;

  SELECT to_jsonb(o) INTO v_onboarding
  FROM public.onboarding_progress o
  WHERE o.user_id = p_user_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'subscription', v_sub,
    'onboarding', v_onboarding,
    'counts', v_counts,
    'recent_laudos', v_recent_laudos,
    'recent_audit', v_recent_audit
  );
END;
$$;

-- 3) Mutations called by edge function via service_role.
--    We keep this as a SECURITY DEFINER RPC so we can also call it from
--    other admin contexts; the edge function enforces role gating before invoking.

CREATE OR REPLACE FUNCTION public.admin_extend_trial(
  p_user_id uuid,
  p_days int,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new_end timestamptz;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'invalid_days';
  END IF;
  SELECT to_jsonb(s) INTO v_old FROM public.subscriptions s WHERE user_id = p_user_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'no_subscription'; END IF;

  v_new_end := GREATEST(
    coalesce((v_old->>'trial_end')::timestamptz, now()),
    now()
  ) + make_interval(days => p_days);

  UPDATE public.subscriptions
    SET trial_end = v_new_end,
        current_period_end = GREATEST(current_period_end, v_new_end),
        status = 'TRIALING',
        updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO public.audit_logs(entity, entity_id, action, diff, user_id)
  VALUES ('user', p_user_id, 'extend_trial',
    jsonb_build_object('days', p_days, 'old_trial_end', v_old->'trial_end', 'new_trial_end', v_new_end),
    p_actor);

  RETURN jsonb_build_object('ok', true, 'new_trial_end', v_new_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_courtesy(
  p_user_id uuid,
  p_plan text,
  p_days int,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end timestamptz;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'invalid_days';
  END IF;
  IF p_plan NOT IN ('STARTER','PRO') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  v_end := now() + make_interval(days => p_days);

  INSERT INTO public.subscriptions (user_id, plan, status, current_period_start, current_period_end, payment_provider)
  VALUES (p_user_id, p_plan::plan_type, 'ACTIVE'::subscription_status, now(), v_end, 'courtesy')
  ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        status = 'ACTIVE'::subscription_status,
        current_period_start = now(),
        current_period_end = v_end,
        payment_provider = 'courtesy',
        updated_at = now();

  INSERT INTO public.audit_logs(entity, entity_id, action, diff, user_id)
  VALUES ('user', p_user_id, 'grant_courtesy',
    jsonb_build_object('plan', p_plan, 'days', p_days, 'until', v_end),
    p_actor);

  RETURN jsonb_build_object('ok', true, 'until', v_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_change_plan(
  p_user_id uuid,
  p_plan text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
BEGIN
  IF p_plan NOT IN ('STARTER','PRO') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;
  SELECT plan::text INTO v_old FROM public.subscriptions WHERE user_id = p_user_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'no_subscription'; END IF;

  UPDATE public.subscriptions
    SET plan = p_plan::plan_type, updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO public.audit_logs(entity, entity_id, action, diff, user_id)
  VALUES ('user', p_user_id, 'change_plan',
    jsonb_build_object('old', v_old, 'new', p_plan),
    p_actor);

  RETURN jsonb_build_object('ok', true, 'old', v_old, 'new', p_plan);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_subscription_status(
  p_user_id uuid,
  p_status text,
  p_reason text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
BEGIN
  IF p_status NOT IN ('ACTIVE','TRIALING','CANCELED','INACTIVE','EXPIRED','PAST_DUE') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  SELECT status::text INTO v_old FROM public.subscriptions WHERE user_id = p_user_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'no_subscription'; END IF;

  UPDATE public.subscriptions
    SET status = p_status::subscription_status, updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO public.audit_logs(entity, entity_id, action, diff, user_id)
  VALUES ('user', p_user_id, 'set_status',
    jsonb_build_object('old', v_old, 'new', p_status, 'reason', p_reason),
    p_actor);

  RETURN jsonb_build_object('ok', true, 'old', v_old, 'new', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_log_action(text,uuid,text,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_360(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid,int,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_courtesy(uuid,text,int,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_change_plan(uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid,text,text,uuid) TO service_role;
