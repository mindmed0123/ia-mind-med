CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_plan text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_sort text DEFAULT 'created_at_desc'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_rows JSONB; v_total INT; v_sort TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_sort := CASE WHEN p_sort IN ('created_at_asc','name_asc','name_desc','email_asc','laudos_desc') THEN p_sort ELSE 'created_at_desc' END;

  WITH filtered AS (
    SELECT
      p.id, p.email, p.full_name, p.crm, p.specialty, p.whatsapp, p.phone, p.created_at,
      s.plan::text AS subscription_plan, s.status::text AS subscription_status,
      s.amount_cents, s.billing_interval, s.trial_end, s.current_period_end,
      (SELECT COUNT(*) FROM public.laudos l WHERE l.user_id = p.id) AS laudos_count
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT plan, status, amount_cents, billing_interval, trial_end, current_period_end
      FROM public.subscriptions
      WHERE user_id = p.id
      ORDER BY created_at DESC
      LIMIT 1
    ) s ON true
    WHERE (p_search IS NULL OR (
      p.email ILIKE '%' || p_search || '%' OR
      COALESCE(p.full_name,'') ILIKE '%' || p_search || '%' OR
      COALESCE(p.crm,'') ILIKE '%' || p_search || '%'
    ))
    AND (p_status IS NULL OR s.status::text = p_status)
    AND (p_plan IS NULL OR s.plan::text = p_plan)
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT * FROM filtered
        ORDER BY
          CASE WHEN v_sort = 'created_at_asc' THEN created_at END ASC,
          CASE WHEN v_sort = 'name_asc' THEN full_name END ASC NULLS LAST,
          CASE WHEN v_sort = 'name_desc' THEN full_name END DESC NULLS LAST,
          CASE WHEN v_sort = 'email_asc' THEN email END ASC,
          CASE WHEN v_sort = 'laudos_desc' THEN laudos_count END DESC,
          CASE WHEN v_sort = 'created_at_desc' THEN created_at END DESC
        LIMIT p_limit OFFSET p_offset
      ) t
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer, text) TO authenticated, service_role;

-- The founder slot count is served by public.fundador_vagas(); the raw config table is not read by the app.
DROP POLICY IF EXISTS "leitura publica" ON public.fundadores_config;
REVOKE SELECT ON public.fundadores_config FROM anon, authenticated;
GRANT ALL ON public.fundadores_config TO service_role;