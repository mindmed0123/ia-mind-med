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
                FR: { type: "string" }, Temp: { type: "string" }, SpO2: { type: "string" }
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
          items: {
            type: "object",
            properties: {
              medicamento: { type: "string" },
              dosagem: { type: "string" },
              posologia: { type: "string" },
              duracao: { type: "string" },
              observacoes: { type: "string" },
            },
            required: ["medicamento", "dosagem", "posologia"],
          },
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
      required: ["resumo_clinico", "anamnese", "dados_paciente_extraidos", "hipotese_principal", "hipotese_diferencial", "condutas", "exames", "red_flags", "cid10", "texto_laudo_md", "texto_paciente_md"],
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
      `Assistente clínico PT-BR. Gere laudo estruturado. Regras: sem diagnóstico definitivo, 2 hipóteses, red flags, CID-10. Use iniciais/idade/sexo (LGPD). Disclaimer: "IA para apoio; não substitui avaliação clínica." Extraia dados do paciente e prescricoes_sugeridas da transcrição.`;

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
8. resumo_clinico continua sendo executivo (80-150 palavras) — NÃO substitui a anamnese detalhada.`;
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
    const prescricoesSugeridas = laudoData.prescricoes_sugeridas || [];
    const exames = laudoData.exames_sugeridos || laudoData.exames || [];
    const redFlags = laudoData.red_flags || [];
    const cid10 = laudoData.cid10_sugeridos || laudoData.cid10 || [];
    const textoLaudo = laudoData.texto_laudo_md || '';
    const textoPaciente = laudoData.texto_paciente_md || '';
    const resumo = laudoData.resumo_clinico || '';
    const disclaimer = laudoData.avisos_legais || 'Conteúdo gerado por IA para apoio à decisão clínica. Não substitui julgamento médico.';
    const specialtySections = laudoData.specialty_sections || {};

    // ===== DB UPDATE =====
    const t7 = now();
    const { error: updateError } = await supabase
      .from('laudos')
      .update({
        patient_data: laudoData.dados_paciente_extraidos || laudoData.dados_paciente || patient,
        clinical_context: { specialty, chief_complaint, vitals, meds, allergies, exam_findings, contexto_clinico, historico },
        summary: { resumo_clinico: resumo },
        hypotheses: hipoteses,
        conducts: condutas,
        sections: { 
          ...(laudoData.sections || {}), 
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
