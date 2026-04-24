-- Schedule the laudo-watchdog edge function to run every 3 minutes
-- to recover any laudos stuck in 'processing' state.

-- Remove any previous schedule with the same name (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'laudo-watchdog-every-3min') THEN
    PERFORM cron.unschedule('laudo-watchdog-every-3min');
  END IF;
END $$;

SELECT cron.schedule(
  'laudo-watchdog-every-3min',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zwebwrbbrcmajkuptpwq.supabase.co/functions/v1/laudo-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) AS request_id;
  $$
);