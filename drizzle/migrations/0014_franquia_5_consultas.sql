ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consultas_gratuitas_usadas integer NOT NULL DEFAULT 0;
ALTER TABLE public.laudos ADD COLUMN IF NOT EXISTS franquia_consumida boolean NOT NULL DEFAULT false;

UPDATE public.profiles p SET consultas_gratuitas_usadas = u.total
FROM (SELECT user_id, SUM(laudos)::int AS total FROM public.usage_counters GROUP BY user_id) u
WHERE u.user_id = p.id AND NOT public.is_paid_user(p.id);

CREATE OR REPLACE FUNCTION public.proteger_franquia_profiles()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.consultas_gratuitas_usadas := 0;
    ELSIF NEW.consultas_gratuitas_usadas IS DISTINCT FROM OLD.consultas_gratuitas_usadas THEN
      RAISE EXCEPTION 'O contador de consultas gratuitas só pode ser alterado pelo servidor';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proteger_franquia_profiles ON public.profiles;
CREATE TRIGGER proteger_franquia_profiles BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.proteger_franquia_profiles();

CREATE OR REPLACE FUNCTION public.proteger_franquia_laudos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.franquia_consumida := false;
    ELSIF NEW.franquia_consumida IS DISTINCT FROM OLD.franquia_consumida THEN
      RAISE EXCEPTION 'A marcação de franquia só pode ser alterada pelo servidor';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_proteger_franquia_laudos ON public.laudos;
CREATE TRIGGER a_proteger_franquia_laudos BEFORE INSERT OR UPDATE ON public.laudos
FOR EACH ROW EXECUTE FUNCTION public.proteger_franquia_laudos();

-- Gate on insert: block the 6th, never count here.
CREATE OR REPLACE FUNCTION public.enforce_free_laudo_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_used integer;
BEGIN
  IF NEW.user_id IS NULL OR public.is_paid_user(NEW.user_id) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.title,'') LIKE 'Laudo de demonstração%' THEN RETURN NEW; END IF;
  SELECT consultas_gratuitas_usadas INTO v_used FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(v_used,0) >= 5 THEN
    RAISE EXCEPTION 'FRANQUIA_ESGOTADA' USING ERRCODE = 'P0001', HINT = 'Suas 5 consultas gratuitas foram utilizadas. Escolha um plano para continuar.';
  END IF;
  RETURN NEW;
END $$;

-- Count once, when the report actually completes.
CREATE OR REPLACE FUNCTION public.consumir_franquia_laudo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.franquia_consumida = false
     AND COALESCE(NEW.title,'') NOT LIKE 'Laudo de demonstração%'
     AND NOT public.is_paid_user(NEW.user_id) THEN
    NEW.franquia_consumida := true;
    UPDATE public.profiles SET consultas_gratuitas_usadas = consultas_gratuitas_usadas + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS b_consumir_franquia_laudo ON public.laudos;
CREATE TRIGGER b_consumir_franquia_laudo BEFORE UPDATE OF status ON public.laudos
FOR EACH ROW EXECUTE FUNCTION public.consumir_franquia_laudo();
REVOKE ALL ON FUNCTION public.consumir_franquia_laudo() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.free_usage()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_chat integer; v_used integer; v_paid boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  v_paid := public.is_paid_user(v_uid);
  SELECT chat INTO v_chat FROM public.usage_counters WHERE user_id = v_uid AND month = date_trunc('month', now())::date;
  SELECT consultas_gratuitas_usadas INTO v_used FROM public.profiles WHERE id = v_uid;
  v_used := COALESCE(v_used,0);
  RETURN jsonb_build_object('paid', v_paid, 'assinante', v_paid,
    'laudos', v_used, 'laudos_limit', 5,
    'franquia_total', 5, 'franquia_usada', v_used, 'franquia_restante', GREATEST(5 - v_used, 0),
    'chat', COALESCE(v_chat,0), 'chat_limit', 10);
END $$;

CREATE OR REPLACE FUNCTION public.check_and_consume_quota()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_used integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated', 'remaining', 0); END IF;
  IF public.is_paid_user(v_uid) THEN RETURN jsonb_build_object('allowed', true, 'plan', 'pro', 'remaining', null, 'unlimited', true); END IF;
  SELECT consultas_gratuitas_usadas INTO v_used FROM public.profiles WHERE id = v_uid;
  v_used := COALESCE(v_used, 0);
  IF v_used >= 5 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'code', 'FRANQUIA_ESGOTADA', 'remaining', 0, 'plan', 'free'); END IF;
  RETURN jsonb_build_object('allowed', true, 'plan', 'free', 'remaining', 5 - v_used, 'unlimited', false);
END $$;