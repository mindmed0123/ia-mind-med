-- Phase 3: Financial intelligence + Phase 4: Audit feed

CREATE OR REPLACE FUNCTION public.admin_revenue_series(
  p_from timestamptz,
  p_to timestamptz,
  p_granularity text DEFAULT 'day'
) RETURNS TABLE(bucket text, mrr numeric, active_subs int, new_subs int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trunc text;
BEGIN
  IF NOT public.is_billing_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_trunc := CASE p_granularity WHEN 'week' THEN 'week' WHEN 'month' THEN 'month' ELSE 'day' END;

  RETURN QUERY
  WITH series AS (
    SELECT generate_series(date_trunc(v_trunc, p_from), date_trunc(v_trunc, p_to), ('1 '||v_trunc)::interval) AS b
  ),
  active_at AS (
    SELECT s.b,
      sum(
        CASE WHEN sub.billing_interval = 'year'
          THEN coalesce(sub.amount_cents,0)::numeric / 12 / 100
          ELSE coalesce(sub.amount_cents,0)::numeric / 100
        END
      ) AS mrr,
      count(*)::int AS active_subs
    FROM series s
    LEFT JOIN public.subscriptions sub
      ON sub.created_at <= s.b + ('1 '||v_trunc)::interval
     AND (sub.current_period_end IS NULL OR sub.current_period_end >= s.b)
     AND sub.status IN ('ACTIVE','TRIALING','PAST_DUE')
    GROUP BY s.b
  ),
  new_at AS (
    SELECT date_trunc(v_trunc, sub.created_at) AS b, count(*)::int AS new_subs
    FROM public.subscriptions sub
    WHERE sub.created_at >= p_from AND sub.created_at <= p_to
    GROUP BY 1
  )
  SELECT to_char(s.b, 'YYYY-MM-DD') AS bucket,
         coalesce(a.mrr, 0) AS mrr,
         coalesce(a.active_subs, 0) AS active_subs,
         coalesce(n.new_subs, 0) AS new_subs
  FROM series s
  LEFT JOIN active_at a ON a.b = s.b
  LEFT JOIN new_at n ON n.b = s.b
  ORDER BY s.b;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_summary(
  p_from timestamptz,
  p_to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mrr_now numeric := 0;
  v_new_mrr numeric := 0;
  v_churned_mrr numeric := 0;
  v_revenue numeric := 0;
  v_avg_ticket numeric := 0;
  v_active int := 0;
BEGIN
  IF NOT public.is_billing_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    coalesce(sum(
      CASE WHEN billing_interval = 'year'
        THEN coalesce(amount_cents,0)::numeric / 12 / 100
        ELSE coalesce(amount_cents,0)::numeric / 100
      END
    ), 0),
    count(*)
  INTO v_mrr_now, v_active
  FROM public.subscriptions
  WHERE status IN ('ACTIVE','TRIALING','PAST_DUE')
    AND (current_period_end IS NULL OR current_period_end >= now());

  SELECT coalesce(sum(
    CASE WHEN billing_interval = 'year'
      THEN coalesce(amount_cents,0)::numeric / 12 / 100
      ELSE coalesce(amount_cents,0)::numeric / 100
    END
  ), 0)
  INTO v_new_mrr
  FROM public.subscriptions
  WHERE status IN ('ACTIVE','TRIALING')
    AND created_at >= p_from AND created_at <= p_to;

  SELECT coalesce(sum(
    CASE WHEN billing_interval = 'year'
      THEN coalesce(amount_cents,0)::numeric / 12 / 100
      ELSE coalesce(amount_cents,0)::numeric / 100
    END
  ), 0)
  INTO v_churned_mrr
  FROM public.subscriptions
  WHERE status IN ('CANCELED','EXPIRED','INACTIVE')
    AND updated_at >= p_from AND updated_at <= p_to;

  -- naive estimated revenue in period: sum of full subscription amounts touched in window
  SELECT coalesce(sum(coalesce(amount_cents,0)::numeric / 100), 0)
  INTO v_revenue
  FROM public.subscriptions
  WHERE status IN ('ACTIVE','PAST_DUE')
    AND current_period_start >= p_from AND current_period_start <= p_to;

  v_avg_ticket := CASE WHEN v_active > 0 THEN v_mrr_now / v_active ELSE 0 END;

  RETURN jsonb_build_object(
    'mrr_now', v_mrr_now,
    'arr_now', v_mrr_now * 12,
    'new_mrr', v_new_mrr,
    'churned_mrr', v_churned_mrr,
    'net_new_mrr', v_new_mrr - v_churned_mrr,
    'revenue_period', v_revenue,
    'avg_ticket', v_avg_ticket,
    'active_subs', v_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_audit_feed(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_entity text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT coalesce(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
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
$$;

CREATE OR REPLACE FUNCTION public.admin_audit_actions()
RETURNS TABLE(action text, entity text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT DISTINCT al.action, al.entity FROM public.audit_logs al ORDER BY 2, 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revenue_series(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_financial_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_feed(timestamptz, timestamptz, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_actions() TO authenticated;
