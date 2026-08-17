CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_days INTEGER;
  v_has_manual_trial BOOLEAN;
  v_plan plan_type;
  v_credits INTEGER;
  v_org_id UUID;
  v_full_name TEXT;
BEGIN
  v_has_manual_trial := NEW.raw_user_meta_data ? 'trial_days';
  v_trial_days := CASE
    WHEN v_has_manual_trial THEN (NEW.raw_user_meta_data->>'trial_days')::integer
    ELSE NULL
  END;
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  IF v_has_manual_trial AND v_trial_days > 7 THEN
    v_plan := 'PRO';
    v_credits := NULL;
  ELSE
    v_plan := 'STARTER';
    v_credits := 10;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name);

  IF v_has_manual_trial THEN
    INSERT INTO public.subscriptions (
      user_id, plan, status,
      current_period_start, current_period_end,
      trial_start, trial_end,
      remaining_starter_credits, quota_used
    ) VALUES (
      NEW.id, v_plan, 'TRIALING',
      now(), now() + (v_trial_days || ' days')::interval,
      now(), now() + (v_trial_days || ' days')::interval,
      v_credits, 0
    );
  ELSE
    INSERT INTO public.subscriptions (
      user_id, plan, status,
      current_period_start, current_period_end,
      trial_start, trial_end,
      remaining_starter_credits, quota_used
    ) VALUES (
      NEW.id, v_plan, 'PENDING_CHECKOUT',
      now(), now(),
      NULL, NULL,
      v_credits, 0
    );
  END IF;

  INSERT INTO public.organizations (name, owner_id)
  VALUES (COALESCE(v_full_name, split_part(NEW.email, '@', 1)) || ' - Consultório', NEW.id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, display_name)
  VALUES (v_org_id, NEW.id, 'owner', v_full_name);

  INSERT INTO public.appointment_types (organization_id, name, duration_minutes, color, display_order) VALUES
    (v_org_id, 'Primeira consulta', 60, '#3b82f6', 1),
    (v_org_id, 'Retorno', 30, '#10b981', 2),
    (v_org_id, 'Avaliação', 45, '#f59e0b', 3),
    (v_org_id, 'Teleconsulta', 30, '#8b5cf6', 4);

  RETURN NEW;
END;
$function$;