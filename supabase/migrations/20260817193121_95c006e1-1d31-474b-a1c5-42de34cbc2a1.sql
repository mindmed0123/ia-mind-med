CREATE TABLE IF NOT EXISTS public.conversion_events_sent (
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null,
  event_name text not null,
  created_at timestamptz not null default now(),
  unique (stripe_subscription_id, event_name)
);
GRANT ALL ON public.conversion_events_sent TO service_role;
ALTER TABLE public.conversion_events_sent ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS mm_lp text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS landing_page text;