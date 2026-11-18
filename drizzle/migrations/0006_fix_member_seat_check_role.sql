CREATE OR REPLACE FUNCTION public.protect_org_member_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats integer;
  v_active integer;
BEGIN
  -- Only writes coming from app users are checked; trusted server code
  -- (service role and the signup trigger) is not.
  IF COALESCE(auth.role(), '') NOT IN ('authenticated', 'anon') OR session_user <> 'authenticator' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM true OR OLD.organization_id <> NEW.organization_id) THEN
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