
-- Create specialty_templates table
CREATE TABLE IF NOT EXISTS public.specialty_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty text NOT NULL,
  display_name text NOT NULL,
  system_prompt text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for specialty lookup
CREATE INDEX IF NOT EXISTS idx_specialty_templates_specialty ON public.specialty_templates(specialty);

-- Enable RLS
ALTER TABLE public.specialty_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read templates
CREATE POLICY "Authenticated users can read templates"
  ON public.specialty_templates FOR SELECT
  TO authenticated
  USING (true);

-- Insert 4 initial templates
INSERT INTO public.specialty_templates (specialty, display_name, is_default, system_prompt, sections, extraction_fields)
VALUES (
  'clinica_geral',
  'Clínica Geral',
  true,
  'Você é um assistente médico especializado em clínica geral. Analise a transcrição da consulta médica e gere um laudo clínico estruturado e profissional em português brasileiro.

INSTRUÇÕES:
- Use linguagem médica técnica e precisa
- Identifique e estruture todas as informações clínicas relevantes
- Sugira hipóteses diagnósticas baseadas nos sintomas relatados
- Sugira CID-10 apropriado
- Proponha conduta médica adequada
- Identifique red flags que necessitem atenção imediata
- Extraia TODOS os medicamentos prescritos ou sugeridos durante a consulta e preencha prescricoes_sugeridas
- Extraia dados do paciente (iniciais, idade, sexo, queixa principal, medicações com dose, alergias, comorbidades, histórico clínico e familiar, tabagismo, etilismo, sinais vitais)
- Disclaimer: "Conteúdo IA para apoio; não substitui avaliação clínica."
- Sem diagnóstico definitivo, 2 hipóteses (provável + diferencial), red flags, CID-10
- Use apenas iniciais/idade/sexo (LGPD)',
  '[
    {"key": "anamnese", "label": "Anamnese", "order": 1},
    {"key": "historia_doenca_atual", "label": "História da Doença Atual", "order": 2},
    {"key": "exame_fisico", "label": "Exame Físico", "order": 3},
    {"key": "hipoteses_diagnosticas", "label": "Hipóteses Diagnósticas", "order": 4},
    {"key": "conduta", "label": "Conduta", "order": 5},
    {"key": "exames_solicitados", "label": "Exames Solicitados", "order": 6},
    {"key": "retorno", "label": "Retorno", "order": 7},
    {"key": "red_flags", "label": "Alertas Clínicos", "order": 8}
  ]'::jsonb,
  '["medications", "allergies", "comorbidities", "smoking", "alcohol"]'::jsonb
);

INSERT INTO public.specialty_templates (specialty, display_name, is_default, system_prompt, sections, extraction_fields)
VALUES (
  'dermatologia',
  'Dermatologia',
  false,
  'Você é um assistente médico especializado em dermatologia. Analise a transcrição da consulta dermatológica e gere um laudo estruturado e profissional em português brasileiro.

FOCO DERMATOLÓGICO:
- Descrição morfológica precisa das lesões (tipo, distribuição, coloração, bordas, superfície)
- Tempo de evolução das lesões
- Fatores desencadeantes ou agravantes
- Tratamentos tópicos e sistêmicos já utilizados
- Histórico de exposição solar, alergias de contato
- Classificação das lesões (primárias e secundárias)
- Fotoproteção e orientações dermatológicas específicas
- Extraia TODOS os medicamentos prescritos ou sugeridos e preencha prescricoes_sugeridas
- Extraia dados do paciente (iniciais, idade, sexo, queixa principal, medicações, alergias, comorbidades, histórico)
- Disclaimer: "Conteúdo IA para apoio; não substitui avaliação clínica."
- Sem diagnóstico definitivo, 2 hipóteses (provável + diferencial), red flags, CID-10
- Use apenas iniciais/idade/sexo (LGPD)',
  '[
    {"key": "anamnese", "label": "Anamnese", "order": 1},
    {"key": "descricao_lesoes", "label": "Descrição das Lesões", "order": 2},
    {"key": "localizacao_lesoes", "label": "Localização e Distribuição", "order": 3},
    {"key": "exame_dermatologico", "label": "Exame Dermatológico", "order": 4},
    {"key": "hipoteses_diagnosticas", "label": "Hipóteses Diagnósticas", "order": 5},
    {"key": "conduta", "label": "Conduta", "order": 6},
    {"key": "prescricao_topica", "label": "Prescrição Tópica", "order": 7},
    {"key": "orientacoes", "label": "Orientações", "order": 8},
    {"key": "red_flags", "label": "Alertas Clínicos", "order": 9}
  ]'::jsonb,
  '["medications", "allergies", "comorbidities"]'::jsonb
);

INSERT INTO public.specialty_templates (specialty, display_name, is_default, system_prompt, sections, extraction_fields)
VALUES (
  'pediatria',
  'Pediatria',
  false,
  'Você é um assistente médico especializado em pediatria. Analise a transcrição da consulta pediátrica e gere um laudo estruturado em português brasileiro, adaptado para paciente pediátrico.

FOCO PEDIÁTRICO:
- Sempre registrar idade em anos e meses (ou dias/semanas para neonatos)
- Dados de crescimento e desenvolvimento quando mencionados (peso, altura, perímetro cefálico)
- Marcos do desenvolvimento neuropsicomotor
- Calendário vacinal e status de vacinação
- Aleitamento materno ou tipo de alimentação
- Informações fornecidas pelos responsáveis (pais/guardiões)
- Medicamentos em dose pediátrica (mg/kg quando possível)
- Considerar diagnósticos diferenciais pediátricos
- Extraia TODOS os medicamentos prescritos ou sugeridos e preencha prescricoes_sugeridas
- Extraia dados do paciente (iniciais, idade, sexo, queixa principal, medicações, alergias, comorbidades, histórico)
- Disclaimer: "Conteúdo IA para apoio; não substitui avaliação clínica."
- Sem diagnóstico definitivo, 2 hipóteses (provável + diferencial), red flags, CID-10
- Use apenas iniciais/idade/sexo (LGPD)',
  '[
    {"key": "anamnese", "label": "Anamnese", "order": 1},
    {"key": "dados_crescimento", "label": "Dados Antropométricos", "order": 2},
    {"key": "desenvolvimento", "label": "Desenvolvimento", "order": 3},
    {"key": "vacinacao", "label": "Vacinação", "order": 4},
    {"key": "exame_fisico", "label": "Exame Físico", "order": 5},
    {"key": "hipoteses_diagnosticas", "label": "Hipóteses Diagnósticas", "order": 6},
    {"key": "conduta", "label": "Conduta", "order": 7},
    {"key": "orientacoes_pais", "label": "Orientações aos Responsáveis", "order": 8},
    {"key": "red_flags", "label": "Sinais de Alarme", "order": 9}
  ]'::jsonb,
  '["medications", "allergies", "comorbidities"]'::jsonb
);

INSERT INTO public.specialty_templates (specialty, display_name, is_default, system_prompt, sections, extraction_fields)
VALUES (
  'pronto_atendimento',
  'Pronto-Atendimento',
  false,
  'Você é um assistente médico para atendimento de urgência. Analise a transcrição e gere um laudo de pronto-atendimento objetivo e rápido em português brasileiro.

FOCO URGÊNCIA:
- Objetivo e direto — sem texto desnecessário
- Queixa principal e tempo de início sempre em destaque
- Sinais vitais quando mencionados
- Avaliação de risco e gravidade
- Conduta imediata e observação
- Alta com critérios claros ou encaminhamento
- Extraia TODOS os medicamentos prescritos ou sugeridos e preencha prescricoes_sugeridas
- Extraia dados do paciente (iniciais, idade, sexo, queixa principal, medicações, alergias, comorbidades, histórico)
- Disclaimer: "Conteúdo IA para apoio; não substitui avaliação clínica."
- Sem diagnóstico definitivo, 2 hipóteses (provável + diferencial), red flags, CID-10
- Use apenas iniciais/idade/sexo (LGPD)',
  '[
    {"key": "queixa_principal", "label": "Queixa Principal", "order": 1},
    {"key": "sinais_vitais", "label": "Sinais Vitais", "order": 2},
    {"key": "historia_doenca_atual", "label": "História", "order": 3},
    {"key": "exame_fisico", "label": "Exame Físico", "order": 4},
    {"key": "hipoteses_diagnosticas", "label": "Hipóteses", "order": 5},
    {"key": "conduta_imediata", "label": "Conduta Imediata", "order": 6},
    {"key": "desfecho", "label": "Desfecho", "order": 7},
    {"key": "criterios_retorno", "label": "Critérios de Retorno", "order": 8}
  ]'::jsonb,
  '["medications", "allergies", "comorbidities"]'::jsonb
);
