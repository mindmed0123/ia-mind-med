-- 1) Server-only functions
REVOKE EXECUTE ON FUNCTION public.admin_change_plan(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_grant_courtesy(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_consume_quota(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_quota_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_active_org_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_consume_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_consume_quota() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_change_plan(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_courtesy(uuid, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_consume_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_quota_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_active_org_members(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

-- 2) Organization ownership: only the creator of an organization can add themselves as owner
CREATE OR REPLACE FUNCTION public.is_org_creator(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_org_creator(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_creator(uuid, uuid) TO authenticated, service_role;

ALTER POLICY "Users can insert themselves as owner on org create" ON public.organization_members
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'::org_role
    AND public.is_org_creator(organization_id, auth.uid())
  );

-- 3) Billing-controlled organization fields change only server-side
CREATE OR REPLACE FUNCTION public.protect_org_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.seats_paid IS DISTINCT FROM OLD.seats_paid THEN
      RAISE EXCEPTION 'seats_paid_server_only' USING ERRCODE = '42501';
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'owner_id_server_only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_org_billing_fields ON public.organizations;
CREATE TRIGGER trg_protect_org_billing_fields
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.protect_org_billing_fields();

CREATE OR REPLACE FUNCTION public.protect_org_member_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats integer;
  v_active integer;
  v_client boolean;
BEGIN
  -- Only direct client writes are checked; trusted server code (service role,
  -- invite acceptance and signup functions) runs as a privileged role.
  v_client := COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('authenticated', 'anon')
              AND session_user = 'authenticator'
              AND current_setting('mindmed.trusted_member_write', true) IS DISTINCT FROM 'on';
  IF NOT v_client THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM true OR OLD.organization_id <> NEW.organization_id) THEN
    -- The creator registering themselves as owner of a brand-new organization
    IF NEW.user_id = auth.uid() AND NEW.role = 'owner' AND public.is_org_creator(NEW.organization_id, auth.uid())
       AND NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = NEW.organization_id AND m.is_active AND m.id <> NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT seats_paid INTO v_seats FROM public.organizations WHERE id = NEW.organization_id;
    SELECT COUNT(*)::int INTO v_active FROM public.organization_members
      WHERE organization_id = NEW.organization_id AND is_active AND id <> NEW.id;
    IF v_active >= COALESCE(v_seats, 1) THEN
      RAISE EXCEPTION 'no_seats_available' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_org_member_seats() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_org_member_seats ON public.organization_members;
CREATE TRIGGER trg_protect_org_member_seats
  BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_org_member_seats();

-- 4) Patients: organization records require current active membership
ALTER POLICY "Users can view their own patients" ON public.patients
  USING (auth.uid() = user_id AND (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid())));
ALTER POLICY "Users can update their own patients" ON public.patients
  USING (auth.uid() = user_id AND (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid())));
ALTER POLICY "Users can delete their own patients" ON public.patients
  USING (auth.uid() = user_id AND (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid())));

-- 5) Signup: invitation trial is bounded to the published 15-day offer
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_days INTEGER;
  v_has_manual_trial BOOLEAN;
  v_plan plan_type;
  v_credits INTEGER;
  v_org_id UUID;
  v_full_name TEXT;
  m jsonb;
BEGIN
  m := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_has_manual_trial := (m ? 'trial_days') AND COALESCE(m->>'trial_days', '') ~ '^[0-9]{1,4}$';
  v_trial_days := CASE WHEN v_has_manual_trial
                       THEN LEAST(GREATEST((m->>'trial_days')::integer, 1), 15)
                       ELSE NULL END;
  v_full_name := m->>'full_name';

  IF v_has_manual_trial AND v_trial_days > 7 THEN
    v_plan := 'PRO';
    v_credits := NULL;
  ELSE
    v_plan := 'STARTER';
    v_credits := 10;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    mm_lp, fbc, fbp, gclid, landing_page
  )
  VALUES (
    NEW.id, NEW.email, v_full_name,
    NULLIF(m->>'utm_source',''), NULLIF(m->>'utm_medium',''), NULLIF(m->>'utm_campaign',''),
    NULLIF(m->>'utm_content',''), NULLIF(m->>'utm_term',''),
    NULLIF(m->>'mm_lp',''), NULLIF(m->>'fbc',''), NULLIF(m->>'fbp',''), NULLIF(m->>'gclid',''),
    NULLIF(m->>'landing_page','')
  );

  IF v_has_manual_trial THEN
    INSERT INTO public.subscriptions (
      user_id, plan, status, current_period_start, current_period_end,
      trial_start, trial_end, remaining_starter_credits, quota_used
    ) VALUES (
      NEW.id, v_plan, 'TRIALING', now(), now() + (v_trial_days || ' days')::interval,
      now(), now() + (v_trial_days || ' days')::interval, v_credits, 0
    );
  ELSE
    INSERT INTO public.subscriptions (
      user_id, plan, status, current_period_start, current_period_end,
      trial_start, trial_end, remaining_starter_credits, quota_used
    ) VALUES (
      NEW.id, v_plan, 'PENDING_CHECKOUT', now(), now(), NULL, NULL, v_credits, 0
    );
  END IF;

  INSERT INTO public.organizations (name, owner_id)
  VALUES (COALESCE(v_full_name, split_part(NEW.email, '@', 1)) || ' - Consultório', NEW.id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, display_name)
  VALUES (v_org_id, NEW.id, 'owner', v_full_name);

  INSERT INTO public.appointment_types (organization_id, name, duration_minutes, color, display_order) VALUES
    (v_org_id, 'Primeira consulta', 60, '#3b82f6', 1),
    (v_org_id, 'Retorno', 30, '#10b981', 2),
    (v_org_id, 'Avaliação', 45, '#f59e0b', 3),
    (v_org_id, 'Teleconsulta', 30, '#8b5cf6', 4);

  RETURN NEW;
END;
$function$;