-- Enum de status
CREATE TYPE teleconsulta_status AS ENUM (
  'agendada',
  'sala_aberta',
  'em_andamento',
  'concluida',
  'cancelada',
  'nao_compareceu'
);

-- Tabela principal
CREATE TABLE public.teleconsultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  appointment_id UUID,
  patient_id UUID,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  patient_cpf TEXT,
  room_name TEXT NOT NULL UNIQUE,
  room_url TEXT NOT NULL,
  doctor_token TEXT,
  patient_token TEXT,
  daily_room_id TEXT,
  status teleconsulta_status NOT NULL DEFAULT 'agendada',
  scheduled_at TIMESTAMPTZ,
  room_opened_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  doctor_consent_at TIMESTAMPTZ,
  patient_consent_at TIMESTAMPTZ,
  patient_consent_ip TEXT,
  chief_complaint TEXT,
  notes_during_call TEXT,
  prescription_during_call JSONB,
  transcript_text TEXT,
  laudo_id UUID,
  diagnosis_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

CREATE TABLE public.teleconsulta_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teleconsulta_id UUID NOT NULL REFERENCES public.teleconsultas(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  participant_role TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.teleconsulta_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teleconsulta_id UUID NOT NULL REFERENCES public.teleconsultas(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('doctor', 'patient')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_teleconsultas_org ON public.teleconsultas(organization_id);
CREATE INDEX idx_teleconsultas_doctor ON public.teleconsultas(doctor_id);
CREATE INDEX idx_teleconsultas_status ON public.teleconsultas(status);
CREATE INDEX idx_teleconsultas_scheduled ON public.teleconsultas(scheduled_at DESC);
CREATE INDEX idx_teleconsulta_events_tid ON public.teleconsulta_events(teleconsulta_id);
CREATE INDEX idx_teleconsulta_messages_tid ON public.teleconsulta_messages(teleconsulta_id);

-- Trigger updated_at
CREATE TRIGGER teleconsultas_updated_at
  BEFORE UPDATE ON public.teleconsultas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.teleconsultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teleconsulta_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teleconsulta_messages ENABLE ROW LEVEL SECURITY;

-- Médico/equipe: gerenciamento total
CREATE POLICY "org_members_manage_teleconsultas"
  ON public.teleconsultas FOR ALL
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- Acesso público (paciente via token) — apenas leitura quando sala aberta/em andamento
CREATE POLICY "public_room_read_teleconsultas"
  ON public.teleconsultas FOR SELECT
  TO anon, authenticated
  USING (status IN ('sala_aberta', 'em_andamento', 'agendada'));

-- Eventos — membros da org
CREATE POLICY "org_members_manage_events"
  ON public.teleconsulta_events FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teleconsultas t
            WHERE t.id = teleconsulta_id AND public.is_org_member(t.organization_id, auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teleconsultas t
            WHERE t.id = teleconsulta_id AND public.is_org_member(t.organization_id, auth.uid()))
  );

-- Eventos públicos: qualquer um pode inserir evento se a sala está aberta/em andamento
CREATE POLICY "public_insert_events"
  ON public.teleconsulta_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teleconsultas t
            WHERE t.id = teleconsulta_id AND t.status IN ('sala_aberta', 'em_andamento'))
  );

-- Mensagens — membros da org
CREATE POLICY "org_members_manage_messages"
  ON public.teleconsulta_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teleconsultas t
            WHERE t.id = teleconsulta_id AND public.is_org_member(t.organization_id, auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teleconsultas t
            WHERE t.id = teleconsulta_id AND public.is_org_member(t.organization_id, auth.uid()))
  );

-- Mensagens públicas: leitura e inserção quando sala aberta/em andamento
CREATE POLICY "public_read_messages"
  ON public.teleconsulta_messages FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teleconsultas t
            WHERE t.id = teleconsulta_id AND t.status IN ('sala_aberta', 'em_andamento'))
  );

CREATE POLICY "public_insert_messages"
  ON public.teleconsulta_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teleconsultas t
            WHERE t.id = teleconsulta_id AND t.status IN ('sala_aberta', 'em_andamento'))
  );

-- Permite paciente registrar consentimento via update restrito
CREATE POLICY "public_patient_consent_update"
  ON public.teleconsultas FOR UPDATE
  TO anon, authenticated
  USING (status IN ('sala_aberta', 'em_andamento', 'agendada'))
  WITH CHECK (status IN ('sala_aberta', 'em_andamento', 'agendada'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.teleconsultas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teleconsulta_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teleconsulta_events;