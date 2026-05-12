
-- Drop overly-permissive update policy
DROP POLICY IF EXISTS "public_patient_consent_update" ON public.teleconsultas;

-- Create dedicated RPC for patient consent registration
CREATE OR REPLACE FUNCTION public.register_patient_consent(
  p_id uuid,
  p_consent_at timestamptz DEFAULT now(),
  p_consent_ip text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status teleconsulta_status;
BEGIN
  SELECT status INTO v_status FROM public.teleconsultas WHERE id = p_id;
  IF v_status IS NULL THEN
    RETURN false;
  END IF;
  IF v_status NOT IN ('agendada', 'sala_aberta', 'em_andamento') THEN
    RETURN false;
  END IF;

  UPDATE public.teleconsultas
  SET patient_consent_at = COALESCE(p_consent_at, now()),
      patient_consent_ip = COALESCE(p_consent_ip, patient_consent_ip)
  WHERE id = p_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_patient_consent(uuid, timestamptz, text) TO anon, authenticated;
