ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS modelo_padrao_id text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS modelo_padrao_id text, ADD COLUMN IF NOT EXISTS modelo_padrao_travado boolean NOT NULL DEFAULT false;
CREATE TABLE public.modelos_laudo_usuario (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, nome text NOT NULL, base text NOT NULL, inferencia boolean NOT NULL, secoes jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_laudo_usuario TO authenticated;
GRANT ALL ON public.modelos_laudo_usuario TO service_role;
ALTER TABLE public.modelos_laudo_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY modelos_owner ON public.modelos_laudo_usuario FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.validar_modelo_documento() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
IF NEW.base NOT IN ('padrao','soap','anamnese','evolucao','exame') THEN RAISE EXCEPTION 'Modelo de origem inválido'; END IF;
NEW.inferencia := (NEW.base = 'padrao');
IF length(trim(NEW.nome)) NOT BETWEEN 1 AND 100 OR jsonb_typeof(NEW.secoes) <> 'array' OR jsonb_array_length(NEW.secoes) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Nome ou seções inválidos'; END IF;
RETURN NEW; END; $$;
CREATE TRIGGER validar_modelo_documento BEFORE INSERT OR UPDATE ON public.modelos_laudo_usuario FOR EACH ROW EXECUTE FUNCTION public.validar_modelo_documento();
CREATE TABLE public.preferencias_documento (user_id uuid PRIMARY KEY, fonte text NOT NULL DEFAULT 'Inter', corpo numeric NOT NULL DEFAULT 10, margem_superior numeric NOT NULL DEFAULT 30, margem_inferior numeric NOT NULL DEFAULT 18, margem_lateral numeric NOT NULL DEFAULT 18, cabecalho boolean NOT NULL DEFAULT true, logo boolean NOT NULL DEFAULT true, papel_timbrado text, rodape boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias_documento TO authenticated;
GRANT ALL ON public.preferencias_documento TO service_role;
ALTER TABLE public.preferencias_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY preferencias_owner ON public.preferencias_documento FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.auditar_modelo_laudo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
IF NEW.status = 'completed' AND NEW.sections->>'scope_version' = 'modelos-2026-10' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.sections->>'modelo_id' IS DISTINCT FROM NEW.sections->>'modelo_id') THEN
INSERT INTO public.audit_logs(entity, entity_id, user_id, action, diff) VALUES ('REPORT', NEW.id, NEW.user_id, 'GENERATE', jsonb_build_object('modelo_id',NEW.sections->>'modelo_id','modelo_nome',NEW.sections->>'modelo_nome','inferencia',(NEW.sections->>'inferencia')::boolean,'scope_version',NEW.sections->>'scope_version','autoria',NEW.user_id,'horario',now()));
END IF; RETURN NEW; END; $$;
CREATE TRIGGER auditar_modelo_laudo AFTER UPDATE ON public.laudos FOR EACH ROW EXECUTE FUNCTION public.auditar_modelo_laudo();