UPDATE public.medications SET
  principio_ativo = 'Semaglutida',
  apresentacao = 'Caneta preenchida 1,5 mL — 2 mg por caneta (doses semanais)',
  concentracao = '2 mg/1,5 mL',
  posologia_referencia = 'Iniciar com 0,25 mg SC 1x/semana por 4 semanas. Escalonar: 0,5 mg → 1 mg → 1,7 mg → 2 mg SC 1x/semana (dose de manutenção). Aplicar no abdome, coxa ou braço, podendo alternar o local.',
  indicacoes = 'Tratamento crônico da obesidade (IMC ≥ 30) ou sobrepeso (IMC ≥ 27) com comorbidades. Primeira caneta emagrecedora 100% brasileira aprovada pela ANVISA com semaglutida.',
  contraindicacoes = 'Hipersensibilidade à semaglutida; histórico pessoal/familiar de carcinoma medular de tireoide (CMT); NEM tipo 2; gestação e amamentação; pancreatite prévia; doença renal ou hepática grave sem acompanhamento.',
  updated_at = now()
WHERE nome_comercial = 'Ozivy';