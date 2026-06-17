
-- Stripe real amount columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'brl',
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'month';

-- Helper: any admin-class role
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','finance','support','sales')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_billing_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','finance')
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_calc_mrr()
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_mrr_cents BIGINT;
BEGIN
  IF NOT public.is_billing_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN amount_cents IS NULL THEN 0
      WHEN billing_interval = 'year' THEN amount_cents / 12
      ELSE amount_cents
    END
  ),0)
  INTO v_mrr_cents
  FROM public.subscriptions
  WHERE status = 'ACTIVE';

  RETURN ROUND(v_mrr_cents::numeric / 100.0, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_trial_conversion(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_total INT; v_converted INT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COUNT(*) INTO v_total FROM public.subscriptions
  WHERE trial_start BETWEEN p_from AND p_to;

  SELECT COUNT(*) INTO v_converted FROM public.subscriptions
  WHERE trial_start BETWEEN p_from AND p_to AND status = 'ACTIVE';

  IF v_total = 0 THEN RETURN 0; END IF;
  RETURN ROUND((v_converted::numeric / v_total::numeric) * 100.0, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_business_metrics(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_mrr NUMERIC;
BEGIN
  IF NOT public.is_billing_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_mrr := public.admin_calc_mrr();

  RETURN jsonb_build_object(
    'mrr', v_mrr,
    'arr', ROUND(v_mrr * 12, 2),
    'active',   (SELECT COUNT(*) FROM public.subscriptions WHERE status='ACTIVE'),
    'trialing', (SELECT COUNT(*) FROM public.subscriptions WHERE status='TRIALING'),
    'churned_period', (SELECT COUNT(*) FROM public.subscriptions
                        WHERE status IN ('CANCELED','EXPIRED')
                          AND updated_at BETWEEN p_from AND p_to),
    'new_signups',    (SELECT COUNT(*) FROM public.profiles
                        WHERE created_at BETWEEN p_from AND p_to),
    'total_users',    (SELECT COUNT(*) FROM public.profiles),
    'trial_conversion', public.admin_trial_conversion(p_from, p_to),
    'avg_ticket', CASE
      WHEN (SELECT COUNT(*) FROM public.subscriptions WHERE status='ACTIVE' AND amount_cents IS NOT NULL) > 0
      THEN ROUND((SELECT AVG(
        CASE WHEN billing_interval='year' THEN amount_cents/12.0 ELSE amount_cents END
      )/100.0 FROM public.subscriptions WHERE status='ACTIVE' AND amount_cents IS NOT NULL), 2)
      ELSE 0
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_signup_series(
  p_from TIMESTAMPTZ, p_to TIMESTAMPTZ, p_granularity TEXT DEFAULT 'day'
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB; v_gran TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_gran := CASE WHEN p_granularity IN ('day','week','month') THEN p_granularity ELSE 'day' END;

  EXECUTE format($q$
    SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', cnt) ORDER BY bucket), '[]'::jsonb)
    FROM (
      SELECT to_char(date_trunc(%L, created_at), 'YYYY-MM-DD') AS bucket, COUNT(*) AS cnt
      FROM public.profiles
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY 1
    ) t
  $q$, v_gran) INTO v_result USING p_from, p_to;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_subscription_breakdown()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_result FROM (
    SELECT status, plan, COUNT(*)::int AS count
    FROM public.subscriptions GROUP BY status, plan ORDER BY count DESC
  ) t;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_plan   TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 25,
  p_offset INT  DEFAULT 0,
  p_sort   TEXT DEFAULT 'created_at_desc'
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rows JSONB; v_total INT; v_order TEXT;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  v_order := CASE p_sort
    WHEN 'created_at_asc'  THEN 'p.created_at ASC'
    WHEN 'name_asc'        THEN 'p.full_name ASC NULLS LAST'
    WHEN 'name_desc'       THEN 'p.full_name DESC NULLS LAST'
    WHEN 'email_asc'       THEN 'p.email ASC'
    WHEN 'laudos_desc'     THEN 'laudos_count DESC'
    ELSE 'p.created_at DESC'
  END;

  EXECUTE format($q$
    WITH filtered AS (
      SELECT
        p.id, p.email, p.full_name, p.crm, p.specialty, p.whatsapp, p.phone, p.created_at,
        s.plan AS subscription_plan, s.status AS subscription_status,
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
      AND ($2 IS NULL OR s.status = $2)
      AND ($3 IS NULL OR s.plan = $3)
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
$$;

REVOKE ALL ON FUNCTION public.admin_calc_mrr() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_business_metrics(TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_signup_series(TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_subscription_breakdown() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_trial_conversion(TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(TEXT,TEXT,TEXT,INT,INT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_billing_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_calc_mrr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_business_metrics(TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_signup_series(TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subscription_breakdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_trial_conversion(TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT,TEXT,TEXT,INT,INT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_billing_admin(uuid) TO authenticated;
