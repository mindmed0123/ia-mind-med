-- =====================================================
-- MÓDULO DE AGENDAMENTOS - FASE 1
-- =====================================================

-- ENUM: papel do membro na organização
CREATE TYPE public.org_role AS ENUM ('owner', 'doctor', 'staff');

-- ENUM: status do agendamento
CREATE TYPE public.appointment_status AS ENUM (
  'scheduled',     -- agendado
  'confirmed',     -- confirmado manualmente
  'in_progress',   -- em atendimento
  'completed',     -- concluído
  'cancelled',     -- cancelado
  'no_show'        -- faltou
);

-- ENUM: origem do agendamento
CREATE TYPE public.appointment_source AS ENUM ('internal', 'online');

-- =====================================================
-- TABELA: organizations
-- =====================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_owner ON public.organizations(owner_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TABELA: organization_members
-- =====================================================
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.org_role NOT NULL DEFAULT 'doctor',
  display_name TEXT,
  display_color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECURITY DEFINER FUNCTIONS (evitam recursão em RLS)
-- =====================================================

-- Verifica se usuário é membro de uma organização
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND is_active = true
  )
$$;

-- Retorna IDs de organizações do usuário
CREATE OR REPLACE FUNCTION public.get_user_organizations(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id AND is_active = true
$$;

-- Verifica se usuário é owner da organização
CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND role = 'owner' AND is_active = true
  )
$$;

-- =====================================================
-- RLS: organizations
-- =====================================================
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can update their organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_owner(id, auth.uid()));

CREATE POLICY "Authenticated can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- =====================================================
-- RLS: organization_members
-- =====================================================
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can manage members"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_owner(organization_id, auth.uid()));

CREATE POLICY "Users can insert themselves as owner on org create"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'owner');

-- =====================================================
-- TABELA: feature_access (controle granular por usuário)
-- =====================================================
CREATE TABLE public.feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key)
);

CREATE INDEX idx_feature_access_user ON public.feature_access(user_id, feature_key);

ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;

-- Função: verifica se usuário tem acesso a uma feature
CREATE OR REPLACE FUNCTION public.has_feature_access(_user_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.feature_access
    WHERE user_id = _user_id
      AND feature_key = _feature_key
      AND enabled = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE POLICY "Users can view their own feature access"
  ON public.feature_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage feature access"
  ON public.feature_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- TABELA: appointment_types
-- =====================================================
CREATE TABLE public.appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appt_types_org ON public.appointment_types(organization_id) WHERE is_active = true;

ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view appointment types"
  ON public.appointment_types FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members manage appointment types"
  ON public.appointment_types FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- =====================================================
-- TABELA: appointments
-- =====================================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name_snapshot TEXT NOT NULL,
  patient_phone_snapshot TEXT,
  patient_email_snapshot TEXT,
  appointment_type_id UUID REFERENCES public.appointment_types(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  source public.appointment_source NOT NULL DEFAULT 'internal',
  notes TEXT,
  internal_notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  laudo_id UUID REFERENCES public.laudos(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

CREATE INDEX idx_appointments_org_date ON public.appointments(organization_id, start_at);
CREATE INDEX idx_appointments_doctor_date ON public.appointments(doctor_id, start_at);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_status ON public.appointments(organization_id, status);

-- Constraint anti-conflito: mesmo médico não pode ter 2 agendamentos sobrepostos
-- (exceto cancelados ou com falta)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments ADD CONSTRAINT no_doctor_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'));

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members create appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND auth.uid() = created_by
  );

CREATE POLICY "Members update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members delete appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- =====================================================
-- TABELA: doctor_availability
-- =====================================================
CREATE TABLE public.doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=domingo
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_availability_range CHECK (end_time > start_time)
);

CREATE INDEX idx_availability_doctor ON public.doctor_availability(doctor_id, weekday);

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view availability"
  ON public.doctor_availability FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members manage availability"
  ON public.doctor_availability FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- =====================================================
-- TABELA: doctor_unavailability (bloqueios)
-- =====================================================
CREATE TABLE public.doctor_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_unavail_range CHECK (end_at > start_at)
);

CREATE INDEX idx_unavail_doctor_date ON public.doctor_unavailability(doctor_id, start_at);

ALTER TABLE public.doctor_unavailability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view unavailability"
  ON public.doctor_unavailability FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members manage unavailability"
  ON public.doctor_unavailability FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- =====================================================
-- TABELA: booking_links (Fase 2)
-- =====================================================
CREATE TABLE public.booking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doctor_id UUID,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  allowed_appointment_type_ids UUID[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_links_token ON public.booking_links(token) WHERE is_active = true;

ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage booking links"
  ON public.booking_links FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- =====================================================
-- ADICIONAR organization_id em patients (compatível)
-- =====================================================
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patients_org ON public.patients(organization_id);

-- =====================================================
-- TRIGGERS: updated_at
-- =====================================================
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_org_members_updated BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_feature_access_updated BEFORE UPDATE ON public.feature_access
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_appt_types_updated BEFORE UPDATE ON public.appointment_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_availability_updated BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- MIGRAÇÃO: criar org pessoal para usuários existentes
-- =====================================================
DO $$
DECLARE
  v_profile RECORD;
  v_org_id UUID;
BEGIN
  FOR v_profile IN SELECT id, full_name, email FROM public.profiles
  LOOP
    -- Cria org se não existe
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE owner_id = v_profile.id) THEN
      INSERT INTO public.organizations (name, owner_id)
      VALUES (
        COALESCE(v_profile.full_name, split_part(v_profile.email, '@', 1)) || ' - Consultório',
        v_profile.id
      )
      RETURNING id INTO v_org_id;

      INSERT INTO public.organization_members (organization_id, user_id, role, display_name)
      VALUES (v_org_id, v_profile.id, 'owner', v_profile.full_name);

      -- Tipos de atendimento padrão
      INSERT INTO public.appointment_types (organization_id, name, duration_minutes, color, display_order) VALUES
        (v_org_id, 'Primeira consulta', 60, '#3b82f6', 1),
        (v_org_id, 'Retorno', 30, '#10b981', 2),
        (v_org_id, 'Avaliação', 45, '#f59e0b', 3),
        (v_org_id, 'Teleconsulta', 30, '#8b5cf6', 4);

      -- Vincula pacientes existentes à org
      UPDATE public.patients SET organization_id = v_org_id WHERE user_id = v_profile.id AND organization_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- ATUALIZA handle_new_user para criar org automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_days INTEGER;
  v_plan plan_type;
  v_credits INTEGER;
  v_org_id UUID;
  v_full_name TEXT;
BEGIN
  v_trial_days := COALESCE((NEW.raw_user_meta_data->>'trial_days')::integer, 7);
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  IF v_trial_days > 7 THEN
    v_plan := 'PRO';
    v_credits := NULL;
  ELSE
    v_plan := 'STARTER';
    v_credits := 10;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name);

  INSERT INTO public.subscriptions (
    user_id, plan, status,
    current_period_start, current_period_end,
    trial_start, trial_end,
    remaining_starter_credits, quota_used
  ) VALUES (
    NEW.id, v_plan, 'TRIALING',
    now(), now() + (v_trial_days || ' days')::interval,
    now(), now() + (v_trial_days || ' days')::interval,
    v_credits, 0
  );

  -- Cria organização pessoal
  INSERT INTO public.organizations (name, owner_id)
  VALUES (COALESCE(v_full_name, split_part(NEW.email, '@', 1)) || ' - Consultório', NEW.id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, display_name)
  VALUES (v_org_id, NEW.id, 'owner', v_full_name);

  -- Tipos de atendimento padrão
  INSERT INTO public.appointment_types (organization_id, name, duration_minutes, color, display_order) VALUES
    (v_org_id, 'Primeira consulta', 60, '#3b82f6', 1),
    (v_org_id, 'Retorno', 30, '#10b981', 2),
    (v_org_id, 'Avaliação', 45, '#f59e0b', 3),
    (v_org_id, 'Teleconsulta', 30, '#8b5cf6', 4);

  RETURN NEW;
END;
$function$;