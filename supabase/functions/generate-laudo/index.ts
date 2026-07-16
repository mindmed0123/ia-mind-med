import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { callLlmWithFallback } from "../_shared/llm-call.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function log(cid: string, step: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), cid, step, ...data }));
}
function now() { return Date.now(); }

// ===== TOOL SCHEMA for structured output =====
const LAUDO_TOOL = {
  type: "function",
  function: {
    name: "generate_laudo",
    description: "Gera um laudo clínico estruturado a partir dos dados do paciente.",
    parameters: {
      type: "object",
      properties: {
        resumo_clinico: { type: "string", description: "Resumo executivo do caso em 80-150 palavras: paciente, queixa, achados-chave, hipótese e plano." },
        anamnese: {
          type: "object",
          description: "Anamnese clínica COMPLETA e detalhada extraída de TUDO que foi falado na consulta. Não resuma demais — preserve sintomas, tempo, intensidade, fatores e contexto.",
          properties: {
            queixa_principal: { type: "string", description: "Queixa principal em 1 frase, com tempo de evolução. Ex.: 'Dor torácica há 3 dias'." },
            hda: { type: "string", description: "História da Doença Atual DETALHADA (mínimo 80 palavras quando houver dados). Inclua: início, duração, localização, irradiação, qualidade, intensidade (0-10), fatores de melhora/piora, sintomas associados, evolução temporal, tratamentos já tentados. Use parágrafos." },
            isda: { type: "string", description: "Interrogatório Sistemático (revisão de sistemas) — sintomas relatados ou negados por sistema (cardiovascular, respiratório, GI, GU, neuro, etc.). Vazio se nada relatado." },
            antecedentes_pessoais: { type: "string", description: "Doenças prévias, cirurgias, internações, alergias relevantes em texto corrido." },
            antecedentes_familiares: { type: "string", description: "História familiar relevante (DM, HAS, neoplasias, cardiopatias, etc.)." },
            habitos_de_vida: { type: "string", description: "Tabagismo, etilismo, drogas, atividade física, alimentação, sono, ocupação." },
            medicacoes_em_uso: { type: "string", description: "Lista textual de medicações em uso com dose/posologia quando citado." },
            sinais_vitais_texto: { type: "string", description: "Sinais vitais em texto formatado: 'PA 120x80 mmHg, FC 80 bpm, FR 16 irpm, SatO2 98%, Tax 36,5°C, Glicemia 90 mg/dL'. Apenas os efetivamente medidos/citados." },
            exame_fisico: { type: "string", description: "Exame físico DETALHADO por aparelhos/segmentos: estado geral, ectoscopia, ACV, AR, abdome, MMII, neuro, etc. Mínimo 60 palavras quando houver achados." },
          },
        },
        dados_paciente_extraidos: {
          type: "object",
          description: "Dados do paciente extraídos da transcrição/texto da consulta",
          properties: {
            nome_completo: {
              type: "string",
              description: "Nome completo do paciente exatamente como mencionado pelo médico na consulta. Deixe vazio se o nome não foi citado em nenhum momento — não invente."
            },
            iniciais: { type: "string" },
            idade: { type: "string" },
            sexo: { type: "string" },
            queixa_principal: { type: "string" },
            medicacoes: { type: "array", items: { type: "string" } },
            alergias: { type: "array", items: { type: "string" } },
            comorbidades: { type: "array", items: { type: "string" } },
            historico: { type: "string" },
            historico_familiar: { type: "string" },
            tabagismo: { type: "boolean" },
            etilismo: { type: "boolean" },
            observacoes_clinicas: { type: "string" },
            sinais_vitais: {
              type: "object",
              properties: {
                PA: { type: "string" }, FC: { type: "string" },
                FR: { type: "string" }, Temp: { type: "string" }, SpO2: { type: "string" },
                Glicemia: { type: "string", description: "Glicemia capilar ou venosa. Ex: '95 mg/dL' ou '95'. Somente se citado." },
                Peso: { type: "string", description: "Peso corporal. Ex: '70 kg'. Somente se citado." },
                Altura: { type: "string", description: "Altura. Ex: '1,70 m'. Somente se citado." },
                IMC: { type: "string", description: "IMC em kg/m². Calcule se peso e altura foram informados. Ex: '24,2'." },
                FC_ritmo: { type: "string", description: "Ritmo cardíaco se mencionado. Ex: 'sinusal', 'fibrilação atrial', 'irregular'." }
              }
            }
          }
        },
        hipotese_principal: {
          type: "object",
          properties: {
            descricao: { type: "string" },
            probabilidade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
            racional: { type: "string" },
            achados_suporte: { type: "array", items: { type: "string" } },
            proximos_passos: { type: "array", items: { type: "string" } },
          },
          required: ["descricao", "probabilidade", "racional", "achados_suporte", "proximos_passos"],
        },
        hipotese_diferencial: {
          type: "object",
          properties: {
            descricao: { type: "string" },
            probabilidade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
            racional: { type: "string" },
          },
          required: ["descricao", "probabilidade", "racional"],
        },
        condutas: { type: "array", items: { type: "string" }, description: "Máximo 6 condutas" },
        prescricoes_sugeridas: {
          type: "array",
          description: "OBRIGATÓRIO retornar ao menos 1 item, NUNCA vazio. Se o médico citou medicamentos, use origem='mencionada'. Se não citou, sugira tratamento de PRIMEIRA LINHA (diretriz) para a hipótese principal, respeitando idade/comorbidades/alergias, com origem='sugerida_ia'. Em casos puramente diagnósticos/encaminhamento (sem terapêutica óbvia) inclua ao menos 1 item de suporte seguro e não controlado (protetor solar, paracetamol s/n, hidratante, SRO). NUNCA sugerir por iniciativa própria controlados (opioides, benzodiazepínicos, listas A/B). Máximo 6 itens.",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              medicamento: { type: "string" },
              dosagem: { type: "string" },
              posologia: { type: "string" },
              duracao: { type: "string" },
              observacoes: { type: "string", description: "Se sugerida_ia, inclua racional curto (ex.: 'IECA - primeira linha para HAS em <55a')." },
              origem: { type: "string", enum: ["mencionada", "sugerida_ia"], description: "mencionada = médico ditou; sugerida_ia = tratamento de 1ª linha sugerido pela IA." },
            },
            required: ["medicamento", "dosagem", "posologia", "origem"],
          },
          maxItems: 6,
        },
        exames: { type: "array", items: { type: "string" }, description: "Máximo 5 exames" },
        red_flags: { type: "array", items: { type: "string" }, description: "Máximo 4 red flags" },
        cid10: { type: "array", items: { type: "string" }, description: "Máximo 3 CID-10" },
        texto_laudo_md: { type: "string", description: "Laudo em Markdown, máximo 600 palavras" },
        texto_paciente_md: { type: "string", description: "Resumo acessível ao paciente, máximo 100 palavras" },
        // Dynamic specialty sections (key-value pairs from the template)
        specialty_sections: {
          type: "object",
          description: "Seções específicas da especialidade conforme template. Cada chave corresponde a uma seção do template.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["resumo_clinico", "anamnese", "dados_paciente_extraidos", "hipotese_principal", "hipotese_diferencial", "condutas", "prescricoes_sugeridas", "exames", "red_flags", "cid10", "texto_laudo_md", "texto_paciente_md"],
      additionalProperties: false,
    },
  },
};

// Models by mode — fast uses the lightest model for speed; long uses Flash for
// large context windows. Each mode has a fallback model that takes over if the
// primary times out or returns 5xx.
const MODELS = {
  fast: 'google/gemini-2.5-flash-lite',
  complete: 'google/gemini-2.5-flash',
  long: 'google/gemini-2.5-flash',
};
const FALLBACK_MODELS: Record<string, string> = {
  fast: 'google/gemini-2.5-flash',
  complete: 'google/gemini-2.5-flash-lite',
  long: 'google/gemini-2.5-flash-lite',
};

const MAX_TOKENS = { fast: 2500, complete: 4000, long: 5000 };
// Long mode receives a pre-condensed transcript (map-reduce summaries) so we
// can be more generous on input characters without exploding the context.
const MAX_INPUT_CHARS = { fast: 3500, complete: 8000, long: 16000 };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const cid = crypto.randomUUID();
  const t0 = now();
  let currentLaudoId: string | null = null;

  try {
    // ===== AUTH =====
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jwtMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!jwtMatch) {
      return new Response(JSON.stringify({ error: 'Formato inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwtMatch[1]);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const t1 = now();
    log(cid, 'auth_ok', { uid: user.id.substring(0, 8), ms: t1 - t0 });

    // ===== PARSE BODY =====
    const {
      patient, specialty, chief_complaint, transcript, transcript_text, vitals, meds, allergies,
      exam_findings, contexto_clinico, historico, laudo_id, mode = 'fast',
      template_specialty,
    } = await req.json();
    currentLaudoId = laudo_id;

    const updateStage = async (stage: string) => {
      await supabase
        .from('laudos')
        .update({
          status: 'generating',
          last_update_type: stage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', laudo_id)
        .eq('user_id', user.id);
    };

    // ===== PARALLEL: claim + rate limit + template fetch =====
    const resolvedSpecialty = template_specialty || 
      (await supabase.from('profiles').select('specialty').eq('id', user.id).single()).data?.specialty || 
      null;

    const [claimResult, rateLimitResult, templateResult, defaultTemplateResult] = await Promise.all([
      // Atomic claim
      supabase
        .from('laudos')
        .update({ status: 'generating', last_update_type: 'preparing', updated_at: new Date().toISOString() })
        .eq('id', laudo_id)
        .eq('user_id', user.id)
        .in('status', ['draft', 'error'])
        .select('id, status')
        .maybeSingle(),
      // Rate limit check
      supabase
        .from('laudos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()),
      // Template by specialty
      resolvedSpecialty
        ? supabase
            .from('specialty_templates')
            .select('system_prompt, sections, specialty, display_name')
            .eq('specialty', resolvedSpecialty)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Default template fallback
      supabase
        .from('specialty_templates')
        .select('system_prompt, sections, specialty, display_name')
        .eq('is_default', true)
        .maybeSingle(),
    ]);

    // Check idempotency — if claim missed, check if already completed/generating
    if (!claimResult.data && !claimResult.error) {
      const { data: existing } = await supabase
        .from('laudos')
        .select('status')
        .eq('id', laudo_id)
        .eq('user_id', user.id)
        .single();
      
      if (existing?.status === 'completed' || existing?.status === 'generating') {
        log(cid, 'idempotent_skip', { laudo_id, status: existing.status });
        return new Response(JSON.stringify({ success: true, idempotent: true, status: existing.status }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      log(cid, 'idempotent_skip', { laudo_id, reason: 'claim_missed' });
      return new Response(JSON.stringify({ success: true, idempotent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (claimResult.error) {
      throw new Error(`Falha ao iniciar geração: ${claimResult.error.message}`);
    }

    // Rate limit
    if (rateLimitResult.count !== null && rateLimitResult.count >= 5) {
      log(cid, 'rate_limited');
      await supabase.from('laudos').update({ status: 'draft' }).eq('id', laudo_id);
      return new Response(JSON.stringify({ error: 'Limite atingido. Aguarde 1 minuto.', retry_after: 60 }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // Template resolution
    let templateData = templateResult.data || defaultTemplateResult.data || null;

    const t2 = now();
    log(cid, 'checks_ok', { ms: t2 - t0, template: templateData?.specialty || 'default' });

    // ===== TRUNCATE TRANSCRIPT =====
    const transcriptText = typeof transcript === 'string' ? transcript : transcript?.text || transcript_text || '';
    const MAX_CHARS = (MAX_INPUT_CHARS as any)[mode] || MAX_INPUT_CHARS.fast;
    const truncated = transcriptText.length > MAX_CHARS
      ? transcriptText.substring(0, MAX_CHARS) + '\n[...truncado para caber no contexto]'
      : transcriptText;

    if (!transcriptText.trim()) {
      throw new Error('Transcrição ausente para gerar o laudo.');
    }

    // ===== BUILD PROMPT =====
    // Use template system prompt if available, otherwise use default
    const baseSystemPrompt = templateData?.system_prompt ||
      `Assistente clínico PT-BR. Gere laudo estruturado. Regras: sem diagnóstico definitivo, 2 hipóteses, red flags, CID-10. Disclaimer: "IA para apoio; não substitui avaliação clínica." Extraia TODOS os dados da transcrição: nome completo do paciente se mencionado, todos os sinais vitais citados, medicações, diagnóstico, conduta e prescricoes_sugeridas.`;

    // Hard requirement: anamnese precisa ser COMPLETA, não um resumo curto.
    const anamneseInstruction = `

REGRAS CRÍTICAS PARA A ANAMNESE (campo "anamnese") — siga TODAS:
1. Extraia TUDO o que foi falado na consulta. Não comprima a HDA em uma frase.
2. anamnese.hda: parágrafo(s) DETALHADO(s) com início, duração, localização, irradiação, qualidade, intensidade, fatores de melhora/piora, sintomas associados, evolução, tratamentos prévios. Mínimo 80 palavras quando a transcrição permitir.
3. anamnese.isda: revisão por sistemas (cardiovascular, respiratório, GI, GU, neurológico, musculoesquelético, pele) com sintomas relatados OU negados pelo paciente.
4. anamnese.antecedentes_pessoais, antecedentes_familiares, habitos_de_vida, medicacoes_em_uso: capture cada item mencionado, mesmo que de passagem ("ex-tabagista 10 anos", "mãe diabética").
5. anamnese.sinais_vitais_texto: APENAS valores realmente medidos/citados, no formato "PA 120x80 mmHg, FC 80 bpm, FR 16 irpm, SatO2 98%, Tax 36,5°C". Não invente. Vazio se nenhum vital foi citado.
6. anamnese.exame_fisico: descreva por aparelhos/segmentos (EG, ectoscopia, ACV, AR, abdome, MMII, neuro). Mínimo 60 palavras quando houver achados.
7. NUNCA invente dados que não estão na transcrição. Se uma informação não foi falada, deixe o campo vazio.
8. resumo_clinico continua sendo executivo (80-150 palavras) — NÃO substitui a anamnese detalhada.
9. NOME DO PACIENTE: se o médico mencionar o nome do paciente em qualquer momento da consulta, capture EXATAMENTE em dados_paciente_extraidos.nome_completo. Não use "Paciente" ou "N/I" como valor — deixe o campo vazio se o nome realmente não foi dito.
10. SINAIS VITAIS COMPLETOS: capture em dados_paciente_extraidos.sinais_vitais CADA valor citado — PA, FC, FR, SpO2, temperatura, glicemia, peso, altura, IMC, ritmo. Preencha também anamnese.sinais_vitais_texto com todos os vitais em formato "PA 120x80 mmHg, FC 80 bpm, Glicemia 95 mg/dL, Peso 70 kg" etc. Não invente — registre apenas o que foi dito. Se Glicemia, Peso ou Altura foram mencionados, eles OBRIGATORIAMENTE devem aparecer nesses campos.
11. PRESCRIÇÕES SUGERIDAS — OBRIGATÓRIO retornar SEMPRE pelo menos 1 item (nunca array vazio):
    a) Se o médico mencionar medicamentos que pretende receitar (não os que o paciente já usa), capture com origem="mencionada", com medicamento, dosagem, posologia e duração conforme dito.
    b) Se o médico NÃO ditou nenhum medicamento novo, monte o esquema de PRIMEIRA LINHA coerente com a hipótese principal, idade, comorbidades, alergias e medicações em uso do paciente (ex.: HAS estágio 1 em <55a → IECA/BRA; DM2 → metformina; ITU não complicada → nitrofurantoína/fosfomicina; asma → CI+SABA). Use origem="sugerida_ia" e posologia usual de diretriz.
    c) NUNCA sugerir por iniciativa própria medicamentos controlados (opioides fortes, benzodiazepínicos, listas A/B da Anvisa). Só inclua-os se o médico os mencionou explicitamente (origem="mencionada").
    d) SEMPRE respeitar alergias declaradas. Em cada item sugerida_ia, coloque em observacoes um racional curto (ex.: "IECA - 1ª linha HAS <55a sem contraindicação").
    e) Se o caso for puramente diagnóstico/encaminhamento sem terapêutica farmacológica óbvia (ex.: dermatoses para biópsia, oncologia para encaminhamento), inclua ao menos 1 item de SUPORTE seguro e não controlado apropriado ao contexto (ex.: protetor solar FPS 60 para lesões dermatológicas fotoexpostas; paracetamol 500 mg s/n para dor leve; hidratante/emoliente; sais de reidratação oral). Origem="sugerida_ia" e observacoes com racional ("medida de suporte enquanto aguarda especialista"). NUNCA retorne array vazio.
    f) Máximo 6 itens.
12. CONDUTA COMPLETA: capture TODA a conduta mencionada — solicitação de exames, encaminhamentos, orientações ao paciente, retorno, prescrições. Nada pode ficar de fora dos campos condutas e prescricoes_sugeridas.`;
const systemPrompt = baseSystemPrompt + anamneseInstruction;

    // Add template sections instruction if available
    let sectionsInstruction = '';
    if (templateData?.sections) {
      const sectionKeys = (templateData.sections as any[]).map((s: any) => s.key);
      sectionsInstruction = `\n\nALÉM dos campos padrão, preencha também o campo specialty_sections com as seguintes chaves: ${sectionKeys.join(', ')}. Cada chave deve conter o texto correspondente à seção.`;
    }

    // Long-mode hint when transcript was condensed by map-reduce
    const longHint = mode === 'long'
      ? '\n\nIMPORTANTE: A entrada abaixo é um resumo consolidado de uma consulta longa (60-90 min) já estruturado por tópicos. Use TODOS os tópicos para construir o laudo final. Não invente dados que não estejam no resumo.'
      : '';

    const fullSystemPrompt = systemPrompt + sectionsInstruction + longHint;

    const parts: string[] = [];
    parts.push(`PAC: ${patient?.iniciais || 'N/I'}, ${patient?.sexo || 'N/I'}, ${patient?.idade || 'N/I'}a`);
    if (specialty) parts.push(`ESP: ${specialty}`);
    if (chief_complaint) parts.push(`QP: ${chief_complaint}`);
    parts.push(`TRANS: ${truncated || 'N/I'}`);
    if (vitals && Object.keys(vitals).length) parts.push(`SV: ${Object.entries(vitals).map(([k,v]) => `${k}:${v}`).join(',')}`);
    if (meds?.length) parts.push(`MED: ${meds.join(',')}`);
    if (allergies?.length) parts.push(`ALERG: ${allergies.join(',')}`);
    if (exam_findings) parts.push(`EF: ${exam_findings}`);
    if (contexto_clinico) parts.push(`CTX: ${contexto_clinico}`);
    if (historico) parts.push(`HIST: ${historico}`);
    const userPrompt = parts.join('\n');

    const promptChars = fullSystemPrompt.length + userPrompt.length;
    const modelUsed = (MODELS as any)[mode] || MODELS.fast;
    const fallbackModel = FALLBACK_MODELS[mode] || FALLBACK_MODELS.fast;
    const maxTokens = (MAX_TOKENS as any)[mode] || MAX_TOKENS.fast;

    log(cid, 'llm_start', {
      laudo_id, model: modelUsed, fallback: fallbackModel, mode,
      prompt_chars: promptChars,
      transcript_chars: transcriptText.length, max_tokens: maxTokens,
      template: templateData?.specialty || 'default',
    });

    // ===== LLM CALL with retry + fallback =====
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) throw new Error('AI não configurada');

    const t4 = now();
    await updateStage('calling_ai');

    let llmResult: Awaited<ReturnType<typeof callLlmWithFallback>>;
    try {
      llmResult = await callLlmWithFallback(
        lovableKey,
        {
          model: modelUsed,
          fallbackModel,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
          tools: [LAUDO_TOOL],
          toolChoice: { type: 'function', function: { name: 'generate_laudo' } },
          maxTokens,
          temperature: 0.15,
          timeoutMs: mode === 'long' ? 90000 : 60000,
          retries: 1,
        },
        (step, data) => log(cid, step, data),
      );
    } catch (e: any) {
      const status = (e as any)?.status;
      log(cid, 'llm_failed_after_fallback', { status, msg: e?.message });
      if (status === 429) {
        await supabase.from('laudos').update({ status: 'draft' }).eq('id', laudo_id);
        return new Response(JSON.stringify({ error: 'Limite de requisições. Aguarde.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        await supabase.from('laudos').update({ status: 'draft' }).eq('id', laudo_id);
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Falha na geração do laudo após retry e fallback.');
    }

    const t5 = now();
    const llmMs = t5 - t4;
    const data = llmResult.data;
    const actualModel = llmResult.modelUsed;
    const usage = data.usage;
    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason;

    log(cid, 'llm_done', {
      llm_ms: llmMs,
      tokens: usage?.total_tokens,
      finish_reason: finishReason,
      model_used: actualModel,
      fell_back: llmResult.fellBack,
      attempts: llmResult.attempts,
    });
    // ===== PARSE RESPONSE =====
    const t6 = now();
    let laudoData: any;

    const toolCall = choice?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        laudoData = JSON.parse(toolCall.function.arguments);
        log(cid, 'parse_tool_ok', { ms: now() - t6 });
      } catch {
        log(cid, 'parse_tool_fail');
      }
    }

    if (!laudoData) {
      const content = choice?.message?.content;
      if (!content) throw new Error('Resposta vazia da IA.');
      
      let clean = content.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
      clean = clean.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      
      try {
        laudoData = JSON.parse(clean);
        log(cid, 'parse_content_ok', { ms: now() - t6 });
      } catch {
        log(cid, 'parse_fail', { content_len: content.length });
        const fixResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: 'Corrija para JSON válido. Retorne APENAS JSON.' },
              { role: 'user', content: content.substring(0, 6000) }
            ],
            max_tokens: 3000, temperature: 0.1,
          }),
        });
        if (fixResp.ok) {
          const fd = await fixResp.json();
          const fc = fd.choices?.[0]?.message?.content;
          if (fc) {
            const cf = fc.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
            laudoData = JSON.parse(cf);
            log(cid, 'fix_ok');
          } else throw new Error('Fix vazio');
        } else {
          await fixResp.text();
          throw new Error('Fix falhou');
        }
      }
    }

    await updateStage('structuring');

    // ===== NORMALIZE =====
    const hipoteses = laudoData.hipoteses || {
      mais_provavel: laudoData.hipotese_principal || {},
      menos_provavel: laudoData.hipotese_diferencial || {},
    };
    const condutas = laudoData.condutas_recomendadas || laudoData.condutas || [];
    let prescricoesSugeridas: any[] = laudoData.prescricoes_sugeridas || [];
    const exames = laudoData.exames_sugeridos || laudoData.exames || [];
    const redFlags = laudoData.red_flags || [];
    const cid10 = laudoData.cid10_sugeridos || laudoData.cid10 || [];
    const textoLaudo = laudoData.texto_laudo_md || '';
    const textoPaciente = laudoData.texto_paciente_md || '';
    const resumo = laudoData.resumo_clinico || '';
    const disclaimer = laudoData.avisos_legais || 'Conteúdo gerado por IA para apoio à decisão clínica. Não substitui julgamento médico.';
    const specialtySections = laudoData.specialty_sections || {};

    // Anamnese estruturada — fallback para campos antigos quando o modelo não retornar o objeto
    const anamnese = laudoData.anamnese || {};
    const dp = laudoData.dados_paciente_extraidos || {};
    const sinaisVitaisObj = dp.sinais_vitais || {};
    const sinaisVitaisFormatted = anamnese.sinais_vitais_texto
      || Object.entries(sinaisVitaisObj)
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');

    const anamneseSections = {
      queixa: anamnese.queixa_principal || dp.queixa_principal || chief_complaint || '',
      hda: anamnese.hda || resumo || '',
      isda: anamnese.isda || '',
      antecedentes_pessoais: anamnese.antecedentes_pessoais || dp.historico || '',
      antecedentes_familiares: anamnese.antecedentes_familiares || dp.historico_familiar || '',
      habitos_de_vida: anamnese.habitos_de_vida || '',
      medicacoes_em_uso: anamnese.medicacoes_em_uso
        || (Array.isArray(dp.medicacoes) ? dp.medicacoes.join(', ') : ''),
      sinais_vitais_texto: sinaisVitaisFormatted,
      historico: anamnese.antecedentes_pessoais || dp.historico || '',
      exame_fisico: anamnese.exame_fisico || '',
    };

    // ===== ENRIQUECIMENTO: resolver prescrições contra o catálogo (medications) =====
    // Estratégia: para cada item da IA, buscar via search_medications; anexar
    // medication_id/tarja/tipo_receita/is_parceiro/parceiro_nome quando houver
    // match. Se houver equivalente parceiro para o mesmo princípio ativo,
    // incluir sugestao_parceiro. Se não achar, marcar nao_catalogado:true.
    try {
      const stripDose = (s: string) =>
        String(s || '')
          .replace(/\d+([\.,]\d+)?\s*(mg|mcg|g|ml|ui|%|cp|comp|caps|gts|gotas)\b/gi, ' ')
          .replace(/[\/\+].*$/g, ' ') // remove "/500mg" ou "+ clavulanato"
          .replace(/\s+/g, ' ')
          .trim();
      const norm = (s: string) =>
        String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      const enriched: any[] = [];
      for (const p of prescricoesSugeridas) {
        if (!p || !p.medicamento) { enriched.push(p); continue; }
        const raw = String(p.medicamento);
        const q = stripDose(raw) || raw;
        try {
          const { data: results } = await supabase.rpc('search_medications', { q, cid: null });
          const arr = Array.isArray(results) ? results : [];
          if (arr.length === 0) {
            enriched.push({ ...p, nao_catalogado: true });
            continue;
          }
          // Ranquear: prioriza começa-com e igualdade em nome/princípio, depois primeiro
          const nq = norm(q);
          const scored = arr.map((m: any) => {
            const nn = norm(m.nome_comercial);
            const np = norm(m.principio_ativo);
            let score = 0;
            if (nn === nq || np === nq) score += 100;
            if (nn.startsWith(nq) || np.startsWith(nq)) score += 50;
            if (nn.includes(nq) || np.includes(nq)) score += 20;
            if (m.is_parceiro) score += 5;
            return { m, score };
          }).sort((a, b) => b.score - a.score);
          const top = scored[0].m;
          // Sugestão de parceiro: mesmo princípio ativo, é parceiro, é outro registro
          let sugestao_parceiro: string | null = null;
          if (!top.is_parceiro && top.principio_ativo) {
            const paNorm = norm(top.principio_ativo);
            const parc = arr.find((m: any) =>
              m.is_parceiro &&
              m.id !== top.id &&
              norm(m.principio_ativo) === paNorm
            );
            if (parc) {
              sugestao_parceiro = `${parc.nome_comercial}${parc.parceiro_nome ? ` (${parc.parceiro_nome})` : ''}`;
            }
          }
          enriched.push({
            ...p,
            medication_id: top.id,
            principio_ativo: top.principio_ativo,
            tarja: top.tarja,
            tipo_receita: top.tipo_receita,
            is_parceiro: !!top.is_parceiro,
            parceiro: top.parceiro_nome || (top.is_parceiro ? top.laboratorio : null),
            parceiro_nome: top.parceiro_nome || null,
            catalog_nome_comercial: top.nome_comercial,
            sugestao_parceiro,
          });
        } catch (_e) {
          enriched.push({ ...p, nao_catalogado: true });
        }
      }
      prescricoesSugeridas = enriched;
    } catch (e: any) {
      log(cid, 'prescription_enrichment_error', { msg: e?.message });
    }

    // ===== Piso de segurança clínica/legal por nome/princípio ativo =====
    const _norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const _SEV = { branca_comum: 0, antimicrobiano: 1, controle_especial: 2, azul_b: 3, amarela_a: 4 } as const;
    type _TR = keyof typeof _SEV;
    const _AMARELA = [/\bmorfina\b/,/\bfentanil\b/,/\bmetadona\b/,/\boxicodona\b/,/\bhidromorfona\b/,/\bpetidina\b/,/\bmeperidina\b/,/\bmetilfenidato\b/,/\blisdexanfetamina\b/,/\bdexanfetamina\b/,/\banfepramona\b/,/\bfenproporex\b/,/\bmazindol\b/,/\britalina\b/,/\bconcerta\b/,/\bvenvanse\b/,/\bdimesilato\b/];
    const _AZUL = [/\bclonazepam\b/,/\balprazolam\b/,/\bdiazepam\b/,/\bbromazepam\b/,/\blorazepam\b/,/\bmidazolam\b/,/\bflunitrazepam\b/,/\bnitrazepam\b/,/\btriazolam\b/,/\boxazepam\b/,/\bclobazam\b/,/\bestazolam\b/,/\bcloxazolam\b/,/\bzolpidem\b/,/\bzopiclona\b/,/\bzaleplona\b/,/\beszopiclona\b/,/\bbuprenorfina\b/,/\bfrontal\b/,/\brivotril\b/,/\blexotan\b/,/\bvalium\b/,/\bstilnox\b/,/\bturno\b/,/\bdormonid\b/];
    const _CE = [/\btramadol\b/,/\bcodeina\b/,/\bcodein\b/,/\btylex\b/,/\btramal\b/,/\bgesico\b/,/\bpaco\b/,/\bsertralina\b/,/\bfluoxetina\b/,/\bparoxetina\b/,/\bescitalopram\b/,/\bcitalopram\b/,/\bvenlafaxina\b/,/\bdesvenlafaxina\b/,/\bduloxetina\b/,/\bbupropiona\b/,/\bmirtazapina\b/,/\btrazodona\b/,/\bamitriptilina\b/,/\bnortriptilina\b/,/\bclomipramina\b/,/\bimipramina\b/,/\bhaloperidol\b/,/\brisperidona\b/,/\bquetiapina\b/,/\bolanzapina\b/,/\baripiprazol\b/,/\bclozapina\b/,/\blamotrigina\b/,/\bcarbamazepina\b/,/\boxcarbazepina\b/,/\bdivalproato\b/,/\bvalproato\b/,/\btopiramato\b/,/\bgabapentina\b/,/\bpregabalina\b/,/\blevetiracetam\b/,/\bfenitoina\b/,/\bfenobarbital\b/,/\bdonepezila\b/,/\brivastigmina\b/,/\bgalantamina\b/,/\bmemantina\b/,/\bisotretinoina\b/,/\bacitretina\b/];
    const _ATB = [/\bamoxicilina\b/,/\bampicilina\b/,/\bpenicilina\b/,/\bcefalexina\b/,/\bcefadroxil\b/,/\bcefuroxima\b/,/\bceftriaxona\b/,/\bcefepim/,/\bciprofloxacino\b/,/\blevofloxacino\b/,/\bmoxifloxacino\b/,/\bnorfloxacino\b/,/\bazitromicina\b/,/\bclaritromicina\b/,/\beritromicina\b/,/\bclindamicina\b/,/\bsulfametoxazol\b/,/\btrimetoprima\b/,/\bbactrim\b/,/\bmetronidazol\b/,/\btinidazol\b/,/\bsecnidazol\b/,/\bnitrofurantoina\b/,/\bfosfomicina\b/,/\bdoxiciclina\b/,/\btetraciclina\b/,/\bvancomicina\b/,/\blinezolida\b/,/\bgentamicina\b/,/\bamicacina\b/,/\bfluconazol\b/,/\bitraconazol\b/,/\baciclovir\b/,/\bvalaciclovir\b/,/\boseltamivir\b/,/\brifampicina\b/,/\bkeflex\b/,/\bamoxil\b/,/\bcipro\b/,/\bsinot\b/,/\bastro\b/,/\bsubtrax\b/];
    const pisoTipo = (nome?: string, principio?: string): _TR | null => {
      const alvo = [nome, principio].filter(Boolean).map((s) => _norm(String(s))).join(' | ');
      if (!alvo) return null;
      if (_AMARELA.some((r) => r.test(alvo))) return 'amarela_a';
      if (_AZUL.some((r) => r.test(alvo))) return 'azul_b';
      if (_CE.some((r) => r.test(alvo))) return 'controle_especial';
      if (_ATB.some((r) => r.test(alvo))) return 'antimicrobiano';
      return null;
    };
    const inferTipo = (it: any): _TR => {
      let base: _TR = 'branca_comum';
      const raw = String(it.tipo_receita || '').toLowerCase();
      if (['branca_comum','antimicrobiano','controle_especial','azul_b','amarela_a'].includes(raw)) {
        base = raw as _TR;
      } else {
        const tarja = String(it.tarja || '').toLowerCase();
        if (tarja.includes('amarela')) base = 'amarela_a';
        else if (tarja.includes('preta') || tarja.includes('azul')) base = 'azul_b';
        else if (tarja === 'vermelha_retencao') base = 'controle_especial';
      }
      const piso = pisoTipo(it.medicamento, it.principio_ativo);
      if (piso && _SEV[piso] > _SEV[base]) return piso;
      return base;
    };

    // ===== DB UPDATE =====
    const t7 = now();
    const { error: updateError } = await supabase
      .from('laudos')
      .update({
        patient_data: laudoData.dados_paciente_extraidos || laudoData.dados_paciente || patient,
        clinical_context: { specialty, chief_complaint, vitals, meds, allergies, exam_findings, contexto_clinico, historico },
        summary: { resumo_clinico: resumo, anamnese },
        hypotheses: hipoteses,
        conducts: condutas,
        sections: {
          ...(laudoData.sections || {}),
          ...anamneseSections,
          prescricoes_sugeridas: prescricoesSugeridas,
          specialty_sections: specialtySections,
          template_sections: templateData?.sections || [],
        },
        complementary_exams: exames,
        red_flags: redFlags,
        cid10_codes: cid10,
        report_markdown: textoLaudo,
        patient_markdown: textoPaciente,
        legal_disclaimer: disclaimer,
        ai_model: actualModel,
        ai_usage: {
          prompt_tokens: usage?.prompt_tokens,
          completion_tokens: usage?.completion_tokens,
          total_tokens: usage?.total_tokens,
          latency_ms: llmMs,
          latency_total_ms: now() - t0,
          finish_reason: finishReason,
          correlation_id: cid,
          mode,
          fell_back: llmResult.fellBack,
          attempts: llmResult.attempts,
        },
        generation_mode: mode,
        specialty: templateData?.specialty || specialty || null,
        last_update_type: 'complete',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', laudo_id).eq('user_id', user.id);

    if (updateError) {
      log(cid, 'db_error', { error: updateError.message });
      throw new Error('Erro ao salvar.');
    }

    // ===== BEST-EFFORT: criar/atualizar rascunho de receituário gerado por IA =====
    try {
      const validPrescricoes = (Array.isArray(prescricoesSugeridas) ? prescricoesSugeridas : [])
        .filter((p: any) => p && p.medicamento && p.dosagem && p.posologia)
        .slice(0, 6)
        .map((p: any) => {
          const tipoItem = inferTipo(p);
          return {
            medicamento: String(p.medicamento).slice(0, 200),
            dosagem: String(p.dosagem).slice(0, 100),
            posologia: String(p.posologia).slice(0, 200),
            duracao: p.duracao ? String(p.duracao).slice(0, 100) : '',
            observacoes: p.observacoes ? String(p.observacoes).slice(0, 500) : '',
            origem: p.origem === 'sugerida_ia' ? 'sugerida_ia' : 'mencionada',
            // Metadados resolvidos contra o catálogo (podem estar ausentes)
            medication_id: p.medication_id || null,
            principio_ativo: p.principio_ativo || null,
            tarja: p.tarja || null,
            tipo_receita: tipoItem,
            is_parceiro: !!p.is_parceiro,
            parceiro_nome: p.parceiro_nome || null,
            sugestao_parceiro: p.sugestao_parceiro || null,
            nao_catalogado: !!p.nao_catalogado,
          };
        });

      if (validPrescricoes.length > 0) {
        const dpx: any = laudoData.dados_paciente_extraidos || {};
        const patientName = dpx.nome_completo || dpx.iniciais || patient?.nome_completo || patient?.iniciais || 'Paciente';
        const patientSex = dpx.sexo || patient?.sexo || null;
        const hipoteseDesc = laudoData.hipotese_principal?.descricao || '';
        const condutasArr = Array.isArray(condutas) ? condutas : [];
        const cidArr = Array.isArray(cid10) ? cid10 : [];
        const notes = [
          hipoteseDesc ? `Diagnóstico: ${hipoteseDesc}` : null,
          condutasArr.length ? `Conduta: ${condutasArr.join('; ')}` : null,
          cidArr.length ? `CID-10: ${cidArr.join(', ')}` : null,
          '⚠️ Rascunho gerado por IA — revisão médica obrigatória antes da emissão.',
        ].filter(Boolean).join('\n\n');

        const { data: existing } = await supabase
          .from('prescriptions')
          .select('id, status')
          .eq('laudo_id', laudo_id)
          .maybeSingle();

        // Tipo de receita do cabeçalho = mais restritivo entre os itens
        const tipoHeader = validPrescricoes.reduce<_TR>((acc, it) => {
          const t = it.tipo_receita as _TR;
          return _SEV[t] > _SEV[acc] ? t : acc;
        }, 'branca_comum');

        const payload = {
          user_id: user.id,
          laudo_id,
          status: 'rascunho_ia' as const,
          ai_generated: true,
          patient_name: String(patientName).slice(0, 200),
          patient_sex: patientSex ? String(patientSex).slice(0, 20) : null,
          items: validPrescricoes as any,
          notes,
          tipo_receita: tipoHeader,
        };


        if (!existing) {
          const { error: insErr } = await supabase.from('prescriptions').insert(payload);
          if (insErr) log(cid, 'prescription_draft_insert_error', { msg: insErr.message });
          else log(cid, 'prescription_draft_created', { items: validPrescricoes.length });
        } else if (existing.status === 'rascunho_ia') {
          const { error: updErr } = await supabase
            .from('prescriptions')
            .update(payload)
            .eq('id', existing.id);
          if (updErr) log(cid, 'prescription_draft_update_error', { msg: updErr.message });
          else log(cid, 'prescription_draft_updated', { items: validPrescricoes.length });
        } else {
          log(cid, 'prescription_draft_skipped_final', { id: existing.id });
        }
      }
    } catch (e: any) {
      log(cid, 'prescription_draft_exception', { msg: e?.message });
    }

    const t8 = now();
    log(cid, 'complete', {
      laudo_id, model: actualModel, requested_model: modelUsed, mode,
      template: templateData?.specialty || 'default',
      tokens: usage?.total_tokens, llm_ms: llmMs, total_ms: t8 - t0,
      t_auth: t1 - t0, t_checks: t2 - t1, t_llm: llmMs, t_parse: t7 - t5, t_db: t8 - t7,
      fell_back: llmResult.fellBack,
    });

    return new Response(JSON.stringify({
      success: true, 
      metadata: { 
        model: actualModel, requested_model: modelUsed, mode,
        llm_ms: llmMs, total_ms: t8 - t0, correlation_id: cid,
        template_used: templateData?.specialty || 'default',
        template_sections: templateData?.sections || [],
        fell_back: llmResult.fellBack,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    log(cid, 'error', { message: error instanceof Error ? error.message : 'unknown', laudo_id: currentLaudoId, total_ms: now() - t0 });
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && currentLaudoId) {
        const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } }
        });
        await sb.from('laudos').update({ status: 'error', last_update_type: 'error', updated_at: new Date().toISOString() }).eq('id', currentLaudoId);
      }
    } catch { /* best effort */ }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido', correlation_id: cid }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
