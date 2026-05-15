UPDATE public.subscriptions
SET plan = 'PRO',
    status = 'ACTIVE',
    current_period_start = now(),
    current_period_end = '2099-12-31 23:59:59+00',
    trial_end = NULL,
    updated_at = now()
WHERE user_id = '855cbb41-8f35-471e-a907-4912eb96b105';