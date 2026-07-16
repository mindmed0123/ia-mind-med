
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.search_medications(q text DEFAULT NULL::text, cid text DEFAULT NULL::text)
RETURNS TABLE(
  id uuid, nome_comercial text, principio_ativo text, laboratorio text, apresentacao text,
  concentracao text, forma_farmaceutica text, via_administracao text, classe_terapeutica text,
  registro_anvisa text, tarja text, tipo_receita text, posologia_referencia text,
  indicacoes text, contraindicacoes text, cid10_relacionados text[],
  is_parceiro boolean, parceiro_nome text, recomendado_cid boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH qn AS (
    SELECT unaccent(lower(coalesce(q, ''))) AS qt
  )
  SELECT
    m.id, m.nome_comercial, m.principio_ativo, m.laboratorio, m.apresentacao,
    m.concentracao, m.forma_farmaceutica, m.via_administracao, m.classe_terapeutica,
    m.registro_anvisa, m.tarja, m.tipo_receita, m.posologia_referencia,
    m.indicacoes, m.contraindicacoes, m.cid10_relacionados,
    m.is_parceiro, m.parceiro_nome,
    (cid IS NOT NULL AND cid = ANY(coalesce(m.cid10_relacionados, ARRAY[]::text[]))) AS recomendado_cid
  FROM public.medications m, qn
  WHERE m.ativo = true
    AND (
      q IS NULL OR q = ''
      OR to_tsvector('portuguese',
           unaccent(
             coalesce(m.nome_comercial,'') || ' ' ||
             coalesce(m.principio_ativo,'') || ' ' ||
             coalesce(m.classe_terapeutica,'')
           )
         ) @@ plainto_tsquery('portuguese', unaccent(q))
      OR unaccent(lower(m.nome_comercial))  LIKE '%' || qn.qt || '%'
      OR unaccent(lower(m.principio_ativo)) LIKE '%' || qn.qt || '%'
      OR similarity(unaccent(lower(m.nome_comercial)),  qn.qt) > 0.3
      OR similarity(unaccent(lower(m.principio_ativo)), qn.qt) > 0.3
    )
    AND (cid IS NULL OR cid = ANY(coalesce(m.cid10_relacionados, ARRAY[]::text[])))
  ORDER BY
    m.pinned DESC,
    (cid IS NOT NULL AND cid = ANY(coalesce(m.cid10_relacionados, ARRAY[]::text[]))) DESC,
    m.is_parceiro DESC,
    m.destaque_ordem ASC,
    GREATEST(
      similarity(unaccent(lower(m.nome_comercial)),  qn.qt),
      similarity(unaccent(lower(m.principio_ativo)), qn.qt)
    ) DESC,
    m.nome_comercial ASC
  LIMIT 30;
$function$;

REVOKE ALL ON FUNCTION public.search_medications(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_medications(text, text) TO authenticated;

COMMENT ON FUNCTION public.search_medications(text, text) IS
'NÃO remover unaccent/pg_trgm — requisito de matching de áudio (cenários Tamisa/Gesico). Assinatura e colunas de retorno devem ser preservadas para não quebrar MedicationSearch.tsx e a tool MCP.';
