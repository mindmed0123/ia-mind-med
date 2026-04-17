-- 1. Adicionar seats_paid em organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS seats_paid integer NOT NULL DEFAULT 1;

-- 2. Tabela de convites
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  display_color text DEFAULT '#3b82f6',
  role public.org_role NOT NULL DEFAULT 'doctor',
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | cancelled | expired
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invites_token ON public.organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.organization_invites(lower(email));

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Donos veem/gerenciam convites da sua organização
CREATE POLICY "Owners manage invites"
ON public.organization_invites
FOR ALL
TO authenticated
USING (public.is_org_owner(organization_id, auth.uid()))
WITH CHECK (public.is_org_owner(organization_id, auth.uid()));

-- Membros podem ver convites (read-only)
CREATE POLICY "Members view invites"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

-- 3. Função para contar membros ativos
CREATE OR REPLACE FUNCTION public.count_active_org_members(_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.organization_members
  WHERE organization_id = _org_id AND is_active = true;
$$;

-- 4. Função para verificar se usuário é médico convidado (membership em org que NÃO é dele)
CREATE OR REPLACE FUNCTION public.is_invited_doctor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = _user_id
      AND om.is_active = true
      AND o.owner_id != _user_id
      AND om.role IN ('doctor', 'staff')
  );
$$;

-- 5. Trigger para updated_at em invites
CREATE OR REPLACE FUNCTION public.touch_org_invites()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_invites_touch ON public.organization_invites;
CREATE TRIGGER trg_org_invites_touch
BEFORE UPDATE ON public.organization_invites
FOR EACH ROW EXECUTE FUNCTION public.touch_org_invites();

-- 6. Função RPC para aceitar convite (chamada via edge function com service_role,
-- mas também disponível pra usuário autenticado via token)
CREATE OR REPLACE FUNCTION public.accept_organization_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_user_id uuid := auth.uid();
  v_active_count integer;
  v_seats integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE token = _token
  LIMIT 1;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_not_found');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_' || v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.organization_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'invite_expired');
  END IF;

  -- Verifica se já é membro
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_invite.organization_id AND user_id = v_user_id
  ) THEN
    UPDATE public.organization_members
    SET is_active = true, role = v_invite.role,
        display_name = COALESCE(display_name, v_invite.full_name),
        display_color = COALESCE(display_color, v_invite.display_color)
    WHERE organization_id = v_invite.organization_id AND user_id = v_user_id;
  ELSE
    -- Verifica seats disponíveis
    SELECT seats_paid INTO v_seats FROM public.organizations WHERE id = v_invite.organization_id;
    SELECT public.count_active_org_members(v_invite.organization_id) INTO v_active_count;
    
    IF v_active_count >= v_seats THEN
      RETURN jsonb_build_object('ok', false, 'error', 'no_seats_available');
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role, display_name, display_color, is_active)
    VALUES (v_invite.organization_id, v_user_id, v_invite.role, v_invite.full_name, v_invite.display_color, true);
  END IF;

  UPDATE public.organization_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'organization_id', v_invite.organization_id);
END;
$$;

-- 7. Função pública (sem auth) para visualizar dados básicos de um convite (nome da org)
CREATE OR REPLACE FUNCTION public.get_invite_preview(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'email', i.email,
    'full_name', i.full_name,
    'organization_name', o.name,
    'invited_by_name', p.full_name,
    'role', i.role,
    'status', i.status,
    'expires_at', i.expires_at
  ) INTO v_result
  FROM public.organization_invites i
  JOIN public.organizations o ON o.id = i.organization_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.token = _token
  LIMIT 1;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'not_found'));
END;
$$;