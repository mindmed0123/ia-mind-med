ALTER TABLE public.laudos ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

UPDATE public.laudos SET is_demo = true WHERE title LIKE 'Laudo de demonstração%';

CREATE OR REPLACE FUNCTION public.proteger_franquia_laudos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.franquia_consumida := false;
      NEW.is_demo := false;
    ELSE
      IF NEW.franquia_consumida IS DISTINCT FROM OLD.franquia_consumida THEN
        RAISE EXCEPTION 'A marcação de franquia só pode ser alterada pelo servidor';
      END IF;
      IF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
        RAISE EXCEPTION 'A marcação de demonstração só pode ser alterada pelo servidor';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_free_laudo_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_used integer;
BEGIN
  IF NEW.user_id IS NULL OR public.is_paid_user(NEW.user_id) THEN RETURN NEW; END IF;
  IF NEW.is_demo THEN RETURN NEW; END IF;
  SELECT consultas_gratuitas_usadas INTO v_used FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(v_used,0) >= 5 THEN
    RAISE EXCEPTION 'FRANQUIA_ESGOTADA' USING ERRCODE = 'P0001', HINT = 'Suas 5 consultas gratuitas foram utilizadas. Escolha um plano para continuar.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.consumir_franquia_laudo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.franquia_consumida = false
     AND NOT NEW.is_demo
     AND NOT public.is_paid_user(NEW.user_id) THEN
    NEW.franquia_consumida := true;
    UPDATE public.profiles SET consultas_gratuitas_usadas = consultas_gratuitas_usadas + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.consumir_franquia_laudo() FROM PUBLIC, anon, authenticated;

-- Server-side creation of the single onboarding demo report.
CREATE OR REPLACE FUNCTION public.criar_laudo_demonstracao(p_transcript text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.laudos WHERE user_id = v_uid AND is_demo) THEN
    RAISE EXCEPTION 'DEMO_JA_CRIADO' USING ERRCODE = 'P0001', HINT = 'O laudo de demonstração já foi criado nesta conta.';
  END IF;
  INSERT INTO public.laudos (user_id, title, status, generation_mode, transcript, is_demo)
  VALUES (v_uid, 'Laudo de demonstração - ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
          'draft', 'text', jsonb_build_object('text', left(COALESCE(p_transcript,''), 20000)), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.criar_laudo_demonstracao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_laudo_demonstracao(text) TO authenticated;