
CREATE OR REPLACE FUNCTION public.search_medications(q text DEFAULT NULL, cid text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  nome_comercial text,
  principio_ativo text,
  laboratorio text,
  apresentacao text,
  concentracao text,
  forma_farmaceutica text,
  via_administracao text,
  classe_terapeutica text,
  registro_anvisa text,
  tarja text,
  tipo_receita text,
  posologia_referencia text,
  indicacoes text,
  contraindicacoes text,
  cid10_relacionados text[],
  is_parceiro boolean,
  parceiro_nome text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    m.id, m.nome_comercial, m.principio_ativo, m.laboratorio, m.apresentacao,
    m.concentracao, m.forma_farmaceutica, m.via_administracao, m.classe_terapeutica,
    m.registro_anvisa, m.tarja, m.tipo_receita, m.posologia_referencia,
    m.indicacoes, m.contraindicacoes, m.cid10_relacionados,
    m.is_parceiro, m.parceiro_nome
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
    )
    AND (cid IS NULL OR cid = ANY(m.cid10_relacionados))
  ORDER BY m.is_parceiro DESC, m.destaque_ordem ASC, m.nome_comercial ASC
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.search_medications(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_medications(text, text) TO authenticated;
