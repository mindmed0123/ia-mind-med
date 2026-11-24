CREATE OR REPLACE FUNCTION public.request_client_ip()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT nullif(btrim(split_part(coalesce(
    (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'),
    (current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip'),
    ''), ',', 1)), '')
$$;

CREATE OR REPLACE FUNCTION public.request_user_agent()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT left(current_setting('request.headers', true)::jsonb ->> 'user-agent', 400)
$$;

REVOKE ALL ON FUNCTION public.request_client_ip() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_user_agent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_client_ip() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_user_agent() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_document_activity(
  p_action text,
  p_entity text,
  p_entity_id uuid DEFAULT NULL,
  p_content_hash text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_recent int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('COPY', 'DOWNLOAD', 'PRINT', 'SIGN', 'SAVE') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  IF p_entity NOT IN ('REPORT', 'PRESCRIPTION', 'PATIENT', 'EVOLUTION', 'DOCUMENT') THEN
    RAISE EXCEPTION 'invalid_entity';
  END IF;
  IF p_content_hash IS NOT NULL AND p_content_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_hash';
  END IF;
  IF p_details IS NOT NULL AND (jsonb_typeof(p_details) <> 'object' OR length(p_details::text) > 4000) THEN
    RAISE EXCEPTION 'invalid_details';
  END IF;

  -- Só registra ações sobre documentos do próprio médico.
  IF p_entity_id IS NOT NULL THEN
    IF p_entity = 'REPORT' AND NOT EXISTS (SELECT 1 FROM public.laudos WHERE id = p_entity_id AND user_id = v_uid) THEN
      RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
    ELSIF p_entity = 'PRESCRIPTION' AND NOT EXISTS (SELECT 1 FROM public.prescriptions WHERE id = p_entity_id AND user_id = v_uid) THEN
      RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
    ELSIF p_entity = 'PATIENT' AND NOT EXISTS (SELECT 1 FROM public.patients WHERE id = p_entity_id AND user_id = v_uid) THEN
      RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
    ELSIF p_entity = 'EVOLUTION' AND NOT EXISTS (SELECT 1 FROM public.evolution_reports WHERE id = p_entity_id AND user_id = v_uid) THEN
      RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT count(*) INTO v_recent FROM public.audit_logs
  WHERE user_id = v_uid AND created_at > now() - interval '1 minute'
    AND action IN ('COPY', 'DOWNLOAD', 'PRINT', 'SIGN', 'SAVE');
  IF v_recent >= 120 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.audit_logs (entity, entity_id, user_id, action, diff, ip, user_agent)
  VALUES (
    p_entity,
    coalesce(p_entity_id, v_uid),
    v_uid,
    p_action,
    coalesce(p_details, '{}'::jsonb)
      || jsonb_build_object('content_sha256', p_content_hash, 'has_entity', p_entity_id IS NOT NULL),
    public.request_client_ip(),
    public.request_user_agent()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_document_activity(text, text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_document_activity(text, text, uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_terms(
  p_version text,
  p_text_sha256 text,
  p_full_name text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_ip text := public.request_client_ip();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_version IS NULL OR p_version !~ '^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$' THEN
    RAISE EXCEPTION 'invalid_version';
  END IF;
  IF p_text_sha256 IS NULL OR p_text_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_hash';
  END IF;
  IF length(v_name) < 5 OR length(v_name) > 160 OR position(' ' in v_name) = 0 THEN
    RAISE EXCEPTION 'invalid_full_name';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR length(p_items::text) > 2000 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  INSERT INTO public.consent_logs (user_id, consent_type, version, accepted_at, ip, user_agent, metadata)
  VALUES (
    v_uid, 'termo_adesao', p_version, v_now, v_ip, public.request_user_agent(),
    jsonb_build_object('assinatura_nome', v_name, 'texto_sha256', p_text_sha256, 'itens', p_items)
  );

  UPDATE public.profiles
  SET lgpd_consent_given = true,
      lgpd_consent_date = v_now,
      lgpd_consent_version = p_version,
      lgpd_consent_ip = v_ip,
      updated_at = v_now
  WHERE id = v_uid;

  RETURN jsonb_build_object('accepted_at', v_now, 'version', p_version);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_terms(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_terms(text, text, text, jsonb) TO authenticated;