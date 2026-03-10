
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

  -- Create automatic TRIALING subscription (7 days)
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
    now() + interval '7 days',
    now(),
    now() + interval '7 days',
    10,
    0
  );

  RETURN NEW;
END;
$function$;
