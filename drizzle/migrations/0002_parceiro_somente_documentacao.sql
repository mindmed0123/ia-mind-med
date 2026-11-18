ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parceiro_slug text;
COMMENT ON COLUMN public.profiles.parceiro_slug IS 'Parceiro de origem (convênio). Gravado somente pelo servidor no checkout e apenas quando nulo.';

-- Mantenha esta lista igual a supabase/functions/_shared/parceiro-restricoes.ts
CREATE OR REPLACE FUNCTION public.parceiro_somente_documentacao(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND parceiro_slug IN ('sindmepa'))
$$;
REVOKE EXECUTE ON FUNCTION public.parceiro_somente_documentacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parceiro_somente_documentacao(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proteger_parceiro_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.parceiro_slug := NULL;
    ELSIF NEW.parceiro_slug IS DISTINCT FROM OLD.parceiro_slug THEN
      RAISE EXCEPTION 'O vínculo de parceiro só pode ser definido pelo servidor';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.parceiro_slug IS NOT NULL AND NEW.parceiro_slug IS DISTINCT FROM OLD.parceiro_slug THEN
    RAISE EXCEPTION 'Conta já vinculada a um parceiro';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_parceiro_slug ON public.profiles;
CREATE TRIGGER proteger_parceiro_slug
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.proteger_parceiro_slug();

CREATE OR REPLACE FUNCTION public.validar_modelo_documento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
IF NEW.base NOT IN ('padrao','soap','anamnese','evolucao','exame') THEN RAISE EXCEPTION 'Modelo de origem inválido'; END IF;
IF NEW.base = 'padrao' AND public.parceiro_somente_documentacao(NEW.user_id) THEN RAISE EXCEPTION 'Modelo Completo indisponível nas contas do convênio.'; END IF;
NEW.inferencia := (NEW.base = 'padrao');
IF length(trim(NEW.nome)) NOT BETWEEN 1 AND 100 OR jsonb_typeof(NEW.secoes) <> 'array' OR jsonb_array_length(NEW.secoes) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Nome ou seções inválidos'; END IF;
RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.auditar_modelo_laudo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF NEW.status = 'completed' AND NEW.sections->>'scope_version' = 'modelos-2026-10' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.sections->>'modelo_id' IS DISTINCT FROM NEW.sections->>'modelo_id') THEN
INSERT INTO public.audit_logs(entity, entity_id, user_id, action, diff) VALUES ('REPORT', NEW.id, NEW.user_id, 'GENERATE', jsonb_build_object('modelo_id',NEW.sections->>'modelo_id','modelo_nome',NEW.sections->>'modelo_nome','inferencia',(NEW.sections->>'inferencia')::boolean,'scope_version',NEW.sections->>'scope_version','parceiro_slug',NEW.sections->>'parceiro_slug','autoria',NEW.user_id,'horario',now()));
END IF; RETURN NEW; END;
$$;