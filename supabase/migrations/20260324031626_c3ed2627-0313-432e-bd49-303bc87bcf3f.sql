
-- Update handle_new_user to support extended trial via metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_days INTEGER;
BEGIN
  -- Check if extended trial was requested via metadata
  v_trial_days := COALESCE((NEW.raw_user_meta_data->>'trial_days')::integer, 7);
  
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

  -- Create automatic TRIALING subscription
  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    trial_start,
    trial_end,
    remaining_starter_credits,
    quota_used
  ) VALUES (
    NEW.id,
    'STARTER',
    'TRIALING',
    now(),
    now() + (v_trial_days || ' days')::interval,
    now(),
    now() + (v_trial_days || ' days')::interval,
    CASE WHEN v_trial_days > 7 THEN 30 ELSE 10 END,
    0
  );

  RETURN NEW;
END;
$function$;
