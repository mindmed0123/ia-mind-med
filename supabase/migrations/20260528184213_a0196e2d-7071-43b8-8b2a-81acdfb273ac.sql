
-- 1) Control table for funnel emails
CREATE TABLE IF NOT EXISTS public.email_sent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_email_sent_log_user_template
  ON public.email_sent_log (user_id, template_name);
CREATE INDEX IF NOT EXISTS idx_email_sent_log_sent_at
  ON public.email_sent_log (sent_at DESC);

-- Grants (service_role only; no end-user access)
GRANT ALL ON public.email_sent_log TO service_role;

ALTER TABLE public.email_sent_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role manages email_sent_log"
    ON public.email_sent_log FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Hourly cron to dispatch funnel emails via check-email-triggers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-email-triggers-hourly') THEN
    PERFORM cron.unschedule('check-email-triggers-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'check-email-triggers-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://zwebwrbbrcmajkuptpwq.supabase.co/functions/v1/check-email-triggers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $cron$
);
