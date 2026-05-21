
-- ============================================================
-- 1) PATIENTS: enforce organization membership on INSERT/UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Users can create their own patients" ON public.patients;
CREATE POLICY "Users can create their own patients"
ON public.patients FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    organization_id IS NULL
    OR public.is_org_member(organization_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update their own patients" ON public.patients;
CREATE POLICY "Users can update their own patients"
ON public.patients FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    organization_id IS NULL
    OR public.is_org_member(organization_id, auth.uid())
  )
);

-- ============================================================
-- 2) TELECONSULTAS: remove broad anon SELECT, add RPCs
-- ============================================================
DROP POLICY IF EXISTS "public_room_read_teleconsultas" ON public.teleconsultas;

-- Safe RPC for patients (anon) — only returns minimal fields, requires token
CREATE OR REPLACE FUNCTION public.get_teleconsulta_for_patient(
  p_id uuid,
  p_token text
)
RETURNS TABLE (
  id uuid,
  patient_name text,
  patient_email text,
  room_url text,
  patient_token text,
  status teleconsulta_status,
  scheduled_at timestamptz,
  chief_complaint text,
  doctor_consent_at timestamptz,
  patient_consent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.patient_name, t.patient_email, t.room_url,
         t.patient_token, t.status, t.scheduled_at, t.chief_complaint,
         t.doctor_consent_at, t.patient_consent_at
  FROM public.teleconsultas t
  WHERE t.id = p_id
    AND t.patient_token IS NOT NULL
    AND t.patient_token = p_token
    AND t.status = ANY (ARRAY['agendada'::teleconsulta_status,'sala_aberta'::teleconsulta_status,'em_andamento'::teleconsulta_status]);
$$;

REVOKE ALL ON FUNCTION public.get_teleconsulta_for_patient(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_teleconsulta_for_patient(uuid, text) TO anon, authenticated;

-- Lightweight status poller for SalaPaciente realtime fallback
CREATE OR REPLACE FUNCTION public.get_teleconsulta_status_for_patient(
  p_id uuid,
  p_token text
)
RETURNS teleconsulta_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.status FROM public.teleconsultas t
  WHERE t.id = p_id
    AND t.patient_token IS NOT NULL
    AND t.patient_token = p_token;
$$;

REVOKE ALL ON FUNCTION public.get_teleconsulta_status_for_patient(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_teleconsulta_status_for_patient(uuid, text) TO anon, authenticated;

-- ============================================================
-- 3) TELECONSULTA_MESSAGES: drop anon policies, add patient RPCs
-- ============================================================
DROP POLICY IF EXISTS "public_read_messages" ON public.teleconsulta_messages;
DROP POLICY IF EXISTS "public_insert_messages" ON public.teleconsulta_messages;

-- Patient-side read messages (anon, token-gated)
CREATE OR REPLACE FUNCTION public.patient_list_teleconsulta_messages(
  p_id uuid,
  p_token text
)
RETURNS TABLE (
  id uuid,
  teleconsulta_id uuid,
  sender_role text,
  sender_name text,
  content text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.teleconsulta_id, m.sender_role, m.sender_name, m.content, m.created_at
  FROM public.teleconsulta_messages m
  JOIN public.teleconsultas t ON t.id = m.teleconsulta_id
  WHERE m.teleconsulta_id = p_id
    AND t.patient_token IS NOT NULL
    AND t.patient_token = p_token
    AND t.status = ANY (ARRAY['sala_aberta'::teleconsulta_status,'em_andamento'::teleconsulta_status])
  ORDER BY m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.patient_list_teleconsulta_messages(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.patient_list_teleconsulta_messages(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.patient_send_teleconsulta_message(
  p_id uuid,
  p_token text,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_msg_id uuid;
BEGIN
  IF length(coalesce(p_content,'')) = 0 OR length(p_content) > 4000 THEN
    RAISE EXCEPTION 'invalid content';
  END IF;

  SELECT t.patient_name INTO v_name
  FROM public.teleconsultas t
  WHERE t.id = p_id
    AND t.patient_token IS NOT NULL
    AND t.patient_token = p_token
    AND t.status = ANY (ARRAY['sala_aberta'::teleconsulta_status,'em_andamento'::teleconsulta_status]);

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.teleconsulta_messages (teleconsulta_id, sender_role, sender_name, content)
  VALUES (p_id, 'patient', v_name, p_content)
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.patient_send_teleconsulta_message(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.patient_send_teleconsulta_message(uuid, text, text) TO anon, authenticated;

-- ============================================================
-- 4) TELECONSULTA_EVENTS: drop anon insert
-- ============================================================
DROP POLICY IF EXISTS "public_insert_events" ON public.teleconsulta_events;

-- ============================================================
-- 5) HANTAVIRUS bucket: per-user isolation
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual LIKE '%hantavirus-imagens%' OR with_check LIKE '%hantavirus-imagens%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "hantavirus_user_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hantavirus-imagens'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "hantavirus_user_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hantavirus-imagens'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "hantavirus_user_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'hantavirus-imagens'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "hantavirus_user_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'hantavirus-imagens'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- ============================================================
-- 6) Lock down SECURITY DEFINER fns from anon when not needed
-- ============================================================
-- (no-op placeholder — explicit GRANTs above handle exposure)
