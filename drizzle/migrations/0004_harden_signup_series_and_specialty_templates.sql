CREATE OR REPLACE FUNCTION public.admin_signup_series(p_from timestamp with time zone, p_to timestamp with time zone, p_granularity text DEFAULT 'day'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_result JSONB; v_gran TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_gran := CASE WHEN p_granularity IN ('day','week','month') THEN p_granularity ELSE 'day' END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', cnt) ORDER BY bucket), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT to_char(date_trunc(v_gran, created_at), 'YYYY-MM-DD') AS bucket, COUNT(*) AS cnt
    FROM public.profiles
    WHERE created_at BETWEEN p_from AND p_to
    GROUP BY 1
  ) t;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_signup_series(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_signup_series(timestamptz, timestamptz, text) TO authenticated, service_role;

-- Signed-in users see only the template catalog (names and sections); AI instructions stay server-side.
REVOKE SELECT ON public.specialty_templates FROM anon, authenticated;
GRANT SELECT (id, specialty, display_name, sections, is_default, created_at) ON public.specialty_templates TO authenticated;
GRANT ALL ON public.specialty_templates TO service_role;