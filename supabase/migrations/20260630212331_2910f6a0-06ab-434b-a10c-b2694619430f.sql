
CREATE EXTENSION IF NOT EXISTS unaccent;

DROP FUNCTION IF EXISTS public.search_medications(text, text);

CREATE FUNCTION public.search_medications(q text DEFAULT NULL, cid text DEFAULT NULL)
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
AS $$
  SELECT
    m.id, m.nome_comercial, m.principio_ativo, m.laboratorio, m.apresentacao,
    m.concentracao, m.forma_farmaceutica, m.via_administracao, m.classe_terapeutica,
    m.registro_anvisa, m.tarja, m.tipo_receita, m.posologia_referencia,
    m.indicacoes, m.contraindicacoes, m.cid10_relacionados,
    m.is_parceiro, m.parceiro_nome,
    (cid IS NOT NULL AND cid = ANY(coalesce(m.cid10_relacionados, ARRAY[]::text[]))) AS recomendado_cid
  FROM public.medications m
  WHERE m.ativo = true
    AND (
      q IS NULL OR q = '' OR
      to_tsvector('portuguese',
        coalesce(m.nome_comercial,'') || ' ' ||
        coalesce(m.principio_ativo,'') || ' ' ||
        coalesce(m.classe_terapeutica,'')
      ) @@ plainto_tsquery('portuguese', q)
      OR m.nome_comercial ILIKE '%'||q||'%'
      OR m.principio_ativo ILIKE '%'||q||'%'
      OR unaccent(m.nome_comercial) ILIKE '%'||unaccent(coalesce(q,''))||'%'
      OR unaccent(m.principio_ativo) ILIKE '%'||unaccent(coalesce(q,''))||'%'
    )
  ORDER BY
    (cid IS NOT NULL AND cid = ANY(coalesce(m.cid10_relacionados, ARRAY[]::text[]))) DESC,
    m.is_parceiro DESC,
    m.destaque_ordem ASC NULLS LAST,
    m.nome_comercial ASC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.search_medications(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_medications(text, text) TO anon, authenticated;
