CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_plan text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_sort text DEFAULT 'created_at_desc'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_rows JSONB; v_total INT; v_order TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_order := CASE p_sort
    WHEN 'created_at_asc'  THEN 'created_at ASC'
    WHEN 'name_asc'        THEN 'full_name ASC NULLS LAST'
    WHEN 'name_desc'       THEN 'full_name DESC NULLS LAST'
    WHEN 'email_asc'       THEN 'email ASC'
    WHEN 'laudos_desc'     THEN 'laudos_count DESC'
    ELSE 'created_at DESC'
  END;

  EXECUTE format($q$
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
      WHERE ($1 IS NULL OR (
        p.email ILIKE '%%'||$1||'%%' OR
        COALESCE(p.full_name,'') ILIKE '%%'||$1||'%%' OR
        COALESCE(p.crm,'') ILIKE '%%'||$1||'%%'
      ))
      AND ($2 IS NULL OR s.status::text = $2)
      AND ($3 IS NULL OR s.plan::text = $3)
    )
    SELECT
      (SELECT COUNT(*) FROM filtered),
      COALESCE((
        SELECT jsonb_agg(row_to_json(t))
        FROM (SELECT * FROM filtered ORDER BY %s LIMIT $4 OFFSET $5) t
      ), '[]'::jsonb)
  $q$, v_order)
  INTO v_total, v_rows
  USING p_search, p_status, p_plan, p_limit, p_offset;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;