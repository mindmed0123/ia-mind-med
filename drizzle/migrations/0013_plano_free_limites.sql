ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_inicial text, ADD COLUMN IF NOT EXISTS fbclid text;

CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id uuid NOT NULL,
  month date NOT NULL,
  laudos integer NOT NULL DEFAULT 0,
  chat integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Médico vê o próprio uso" ON public.usage_counters FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_paid_user(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role IN ('admin','super_admin'))
      OR EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p_user_id
                 AND (s.status = 'ACTIVE' OR (s.status = 'TRIALING' AND (s.trial_end IS NULL OR s.trial_end > now()))))
      OR COALESCE(public.is_invited_doctor(p_user_id), false)
$$;
REVOKE ALL ON FUNCTION public.is_paid_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_paid_user(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_free_laudo_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month date := date_trunc('month', now())::date; v_used integer;
BEGIN
  IF NEW.user_id IS NULL OR public.is_paid_user(NEW.user_id) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.title,'') LIKE 'Laudo de demonstração%' THEN RETURN NEW; END IF;
  INSERT INTO public.usage_counters(user_id, month) VALUES (NEW.user_id, v_month) ON CONFLICT DO NOTHING;
  SELECT laudos INTO v_used FROM public.usage_counters WHERE user_id = NEW.user_id AND month = v_month FOR UPDATE;
  IF v_used >= 5 THEN
    RAISE EXCEPTION 'FREE_LIMIT_LAUDOS' USING ERRCODE = 'P0001', HINT = 'Plano Free: 5 consultas por mês';
  END IF;
  UPDATE public.usage_counters SET laudos = laudos + 1, updated_at = now() WHERE user_id = NEW.user_id AND month = v_month;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_free_laudo_limit ON public.laudos;
CREATE TRIGGER trg_enforce_free_laudo_limit BEFORE INSERT ON public.laudos FOR EACH ROW EXECUTE FUNCTION public.enforce_free_laudo_limit();

CREATE OR REPLACE FUNCTION public.consume_free_chat(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month date := date_trunc('month', now())::date; v_used integer;
BEGIN
  IF public.is_paid_user(p_user_id) THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true); END IF;
  INSERT INTO public.usage_counters(user_id, month) VALUES (p_user_id, v_month) ON CONFLICT DO NOTHING;
  SELECT chat INTO v_used FROM public.usage_counters WHERE user_id = p_user_id AND month = v_month FOR UPDATE;
  IF v_used >= 10 THEN RETURN jsonb_build_object('allowed', false, 'used', v_used, 'limit', 10); END IF;
  UPDATE public.usage_counters SET chat = chat + 1, updated_at = now() WHERE user_id = p_user_id AND month = v_month;
  RETURN jsonb_build_object('allowed', true, 'used', v_used + 1, 'limit', 10);
END $$;
REVOKE ALL ON FUNCTION public.consume_free_chat(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_free_chat(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.free_usage()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); r record;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT laudos, chat INTO r FROM public.usage_counters WHERE user_id = v_uid AND month = date_trunc('month', now())::date;
  RETURN jsonb_build_object('paid', public.is_paid_user(v_uid), 'laudos', COALESCE(r.laudos,0), 'chat', COALESCE(r.chat,0), 'laudos_limit', 5, 'chat_limit', 10);
END $$;
REVOKE ALL ON FUNCTION public.free_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.free_usage() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_and_consume_quota()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_used integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated', 'remaining', 0); END IF;
  IF public.is_paid_user(v_uid) THEN RETURN jsonb_build_object('allowed', true, 'plan', 'pro', 'remaining', null, 'unlimited', true); END IF;
  SELECT laudos INTO v_used FROM public.usage_counters WHERE user_id = v_uid AND month = date_trunc('month', now())::date;
  v_used := COALESCE(v_used, 0);
  IF v_used >= 5 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'remaining', 0, 'plan', 'free'); END IF;
  RETURN jsonb_build_object('allowed', true, 'plan', 'free', 'remaining', 5 - v_used, 'unlimited', false);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_days INTEGER; v_has_manual_trial BOOLEAN; v_plan plan_type; v_credits INTEGER;
  v_org_id UUID; v_full_name TEXT; m jsonb;
BEGIN
  m := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_has_manual_trial := (m ? 'trial_days') AND COALESCE(m->>'trial_days', '') ~ '^[0-9]{1,4}$';
  v_trial_days := CASE WHEN v_has_manual_trial THEN LEAST(GREATEST((m->>'trial_days')::integer, 1), 15) ELSE NULL END;
  v_full_name := m->>'full_name';
  IF v_has_manual_trial AND v_trial_days > 7 THEN v_plan := 'PRO'; v_credits := NULL;
  ELSE v_plan := 'STARTER'; v_credits := 10; END IF;

  INSERT INTO public.profiles (id, email, full_name, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    mm_lp, fbc, fbp, gclid, fbclid, landing_page, plan_inicial)
  VALUES (NEW.id, NEW.email, v_full_name,
    NULLIF(m->>'utm_source',''), NULLIF(m->>'utm_medium',''), NULLIF(m->>'utm_campaign',''),
    NULLIF(m->>'utm_content',''), NULLIF(m->>'utm_term',''),
    NULLIF(m->>'mm_lp',''), NULLIF(m->>'fbc',''), NULLIF(m->>'fbp',''), NULLIF(m->>'gclid',''),
    LEFT(NULLIF(m->>'fbclid',''), 500), NULLIF(m->>'landing_page',''),
    CASE WHEN m->>'plan_inicial' IN ('free','pro_mensal','pro_anual') THEN m->>'plan_inicial' ELSE NULL END);

  IF v_has_manual_trial THEN
    INSERT INTO public.subscriptions (user_id, plan, status, current_period_start, current_period_end, trial_start, trial_end, remaining_starter_credits, quota_used)
    VALUES (NEW.id, v_plan, 'TRIALING', now(), now() + (v_trial_days || ' days')::interval, now(), now() + (v_trial_days || ' days')::interval, v_credits, 0);
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, status, current_period_start, current_period_end, trial_start, trial_end, remaining_starter_credits, quota_used, plan_origem)
    VALUES (NEW.id, v_plan, 'PENDING_CHECKOUT', now(), now(), NULL, NULL, v_credits, 0, 'mindmed_free');
  END IF;

  INSERT INTO public.organizations (name, owner_id)
  VALUES (COALESCE(v_full_name, split_part(NEW.email, '@', 1)) || ' - Consultório', NEW.id)
  RETURNING id INTO v_org_id;
  INSERT INTO public.organization_members (organization_id, user_id, role, display_name) VALUES (v_org_id, NEW.id, 'owner', v_full_name);
  INSERT INTO public.appointment_types (organization_id, name, duration_minutes, color, display_order) VALUES
    (v_org_id, 'Primeira consulta', 60, '#3b82f6', 1), (v_org_id, 'Retorno', 30, '#10b981', 2),
    (v_org_id, 'Avaliação', 45, '#f59e0b', 3), (v_org_id, 'Teleconsulta', 30, '#8b5cf6', 4);
  RETURN NEW;
END;
$function$;