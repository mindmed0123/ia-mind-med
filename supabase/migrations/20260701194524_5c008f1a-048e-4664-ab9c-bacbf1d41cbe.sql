
-- Add pinned column and pin Ozivy at the top of medication search
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_medications_pinned ON public.medications (pinned) WHERE pinned = true;

-- Insert Ozivy (Liraglutida - caneta emagrecedora brasileira, EMS)
INSERT INTO public.medications (
  nome_comercial, principio_ativo, laboratorio, apresentacao, concentracao,
  forma_farmaceutica, via_administracao, classe_terapeutica, tarja, tipo_receita,
  posologia_referencia, indicacoes, contraindicacoes, cid10_relacionados,
  is_parceiro, parceiro_nome, destaque_ordem, pinned, ativo
) VALUES (
  'Ozivy',
  'Liraglutida',
  'EMS',
  'Caneta preenchida 3mL (6mg/mL) — 18mg por caneta',
  '6 mg/mL',
  'Solução injetável (caneta multidose)',
  'Subcutânea',
  'Análogo de GLP-1 — Tratamento da obesidade e controle de peso',
  'vermelha',
  'branca_comum',
  'Iniciar com 0,6 mg SC 1x/dia por 7 dias. Escalonar semanalmente: 1,2 mg → 1,8 mg → 2,4 mg → dose de manutenção 3,0 mg SC 1x/dia. Aplicar no abdome, coxa ou braço, sempre no mesmo horário.',
  'Tratamento crônico da obesidade (IMC ≥ 30) ou sobrepeso (IMC ≥ 27) com comorbidades. Primeira caneta emagrecedora 100% brasileira aprovada pela ANVISA.',
  'Hipersensibilidade à liraglutida; histórico pessoal/familiar de carcinoma medular de tireoide (CMT); NEM tipo 2; gestação e amamentação; pancreatite prévia.',
  ARRAY['E66','E66.0','E66.1','E66.8','E66.9'],
  true,
  'EMS (Brasil)',
  0,
  true,
  true
)
ON CONFLICT (nome_comercial) DO UPDATE SET
  principio_ativo = EXCLUDED.principio_ativo,
  laboratorio = EXCLUDED.laboratorio,
  apresentacao = EXCLUDED.apresentacao,
  concentracao = EXCLUDED.concentracao,
  forma_farmaceutica = EXCLUDED.forma_farmaceutica,
  classe_terapeutica = EXCLUDED.classe_terapeutica,
  posologia_referencia = EXCLUDED.posologia_referencia,
  indicacoes = EXCLUDED.indicacoes,
  contraindicacoes = EXCLUDED.contraindicacoes,
  cid10_relacionados = EXCLUDED.cid10_relacionados,
  is_parceiro = true,
  parceiro_nome = 'EMS (Brasil)',
  destaque_ordem = 0,
  pinned = true,
  ativo = true,
  updated_at = now();

-- Update search RPC to always place pinned meds first
CREATE OR REPLACE FUNCTION public.search_medications(q text DEFAULT NULL::text, cid text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, nome_comercial text, principio_ativo text, laboratorio text, apresentacao text, concentracao text, forma_farmaceutica text, via_administracao text, classe_terapeutica text, registro_anvisa text, tarja text, tipo_receita text, posologia_referencia text, indicacoes text, contraindicacoes text, cid10_relacionados text[], is_parceiro boolean, parceiro_nome text, recomendado_cid boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    m.pinned DESC,
    (cid IS NOT NULL AND cid = ANY(coalesce(m.cid10_relacionados, ARRAY[]::text[]))) DESC,
    m.is_parceiro DESC,
    m.destaque_ordem ASC NULLS LAST,
    m.nome_comercial ASC
  LIMIT 50;
$function$;
