
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_days INTEGER;
  v_plan plan_type;
  v_credits INTEGER;
BEGIN
  v_trial_days := COALESCE((NEW.raw_user_meta_data->>'trial_days')::integer, 7);
  
  -- VIP trial (15 days) gets PRO plan, normal trial gets STARTER
  IF v_trial_days > 7 THEN
    v_plan := 'PRO';
    v_credits := NULL;
  ELSE
    v_plan := 'STARTER';
    v_credits := 10;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

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

  RETURN NEW;
END;
$function$;
