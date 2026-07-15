CREATE OR REPLACE FUNCTION public.search_medications(q text DEFAULT NULL::text, cid text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, nome_comercial text, principio_ativo text, laboratorio text, apresentacao text, concentracao text, forma_farmaceutica text, via_administracao text, classe_terapeutica text, registro_anvisa text, tarja text, tipo_receita text, posologia_referencia text, indicacoes text, contraindicacoes text, cid10_relacionados text[], is_parceiro boolean, parceiro_nome text, recomendado_cid boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
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
           coalesce(m.nome_comercial,'') || ' ' ||
           coalesce(m.principio_ativo,'') || ' ' ||
           coalesce(m.classe_terapeutica,'')
         ) @@ plainto_tsquery('portuguese', q)
      OR m.nome_comercial ILIKE '%'||q||'%'
      OR m.principio_ativo ILIKE '%'||q||'%'
      OR unaccent(lower(m.nome_comercial)) ILIKE '%'||qn.qt||'%'
      OR unaccent(lower(coalesce(m.principio_ativo,''))) ILIKE '%'||qn.qt||'%'
      OR similarity(unaccent(lower(m.nome_comercial)), qn.qt) > 0.3
      OR similarity(unaccent(lower(coalesce(m.principio_ativo,''))), qn.qt) > 0.3
    )
  ORDER BY
    m.pinned DESC,
    (cid IS NOT NULL AND cid = ANY(coalesce(m.cid10_relacionados, ARRAY[]::text[]))) DESC,
    m.is_parceiro DESC,
    m.destaque_ordem ASC NULLS LAST,
    GREATEST(
      similarity(unaccent(lower(m.nome_comercial)), qn.qt),
      similarity(unaccent(lower(coalesce(m.principio_ativo,''))), qn.qt)
    ) DESC NULLS LAST,
    m.nome_comercial ASC
  LIMIT 50;
$function$;