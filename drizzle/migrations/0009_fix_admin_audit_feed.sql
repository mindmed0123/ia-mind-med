CREATE OR REPLACE FUNCTION public.admin_audit_feed(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_action text DEFAULT NULL::text, p_entity text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows jsonb;
  v_total int;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.audit_logs al
  WHERE (p_from IS NULL OR al.created_at >= p_from)
    AND (p_to   IS NULL OR al.created_at <= p_to)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_entity IS NULL OR al.entity = p_entity);

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      al.id, al.entity, al.entity_id, al.action, al.diff, al.created_at,
      al.user_id AS actor_id,
      ap.email AS actor_email,
      tp.email AS target_email,
      tp.full_name AS target_name
    FROM public.audit_logs al
    LEFT JOIN public.profiles ap ON ap.id = al.user_id
    LEFT JOIN public.profiles tp ON al.entity = 'user' AND tp.id = al.entity_id
    WHERE (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to   IS NULL OR al.created_at <= p_to)
      AND (p_action IS NULL OR al.action = p_action)
      AND (p_entity IS NULL OR al.entity = p_entity)
    ORDER BY al.created_at DESC
    LIMIT greatest(1, least(p_limit, 200))
    OFFSET greatest(0, p_offset)
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_audit_feed(timestamp with time zone, timestamp with time zone, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_audit_feed(timestamp with time zone, timestamp with time zone, text, text, integer, integer) TO authenticated, service_role;