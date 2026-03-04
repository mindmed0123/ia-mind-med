import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured logger - never logs PHI/PII
function log(cid: string, step: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), cid, step, ...data }));
}

function now() { return Date.now(); }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      return new Response(JSON.stringify({ error: 'Formato de autorização inválido' }), {
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
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const t1 = now();
    log(cid, 'auth_ok', { uid: user.id.substring(0, 8), ms: t1 - t0 });

    // ===== PARSE BODY =====
    const {
      patient, specialty, chief_complaint, transcript, vitals, meds, allergies,
      exam_findings, contexto_clinico, historico, hipoteses_previas,
      laudo_id, mode = 'fast'
    } = await req.json();

    currentLaudoId = laudo_id;

    // ===== IDEMPOTENCY =====
    const { data: existingLaudo } = await supabase
      .from('laudos')
      .select('status, updated_at')
      .eq('id', laudo_id)
      .eq('user_id', user.id)
      .single();

    if (existingLaudo?.status === 'completed') {
      log(cid, 'idempotent_skip', { laudo_id });
      return new Response(JSON.stringify({ success: true, idempotent: true, message: 'Laudo já foi gerado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (existingLaudo?.status === 'generating') {
      log(cid, 'already_generating', { laudo_id });
      return new Response(JSON.stringify({ success: true, idempotent: true, message: 'Laudo já está sendo gerado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== RATE LIMITING =====
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentCount } = await supabase
      .from('laudos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('updated_at', oneMinuteAgo);

    if (recentCount !== null && recentCount >= 5) {
      log(cid, 'rate_limited', { count: recentCount });
      return new Response(JSON.stringify({
        error: 'Limite atingido. Aguarde 1 minuto.', retry_after: 60,
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    const t2 = now();
    log(cid, 'checks_ok', { ms: t2 - t0 });

    // ===== CLAIM GENERATION (atomic) =====
    await supabase
      .from('laudos')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', laudo_id)
      .eq('user_id', user.id);

    // ===== TRUNCATE TRANSCRIPT (perf optimization) =====
    const transcriptText = typeof transcript === 'string' ? transcript : transcript?.text || '';
    const MAX_TRANSCRIPT_CHARS = 4000;
    const truncatedTranscript = transcriptText.length > MAX_TRANSCRIPT_CHARS
      ? transcriptText.substring(0, MAX_TRANSCRIPT_CHARS) + '\n[...texto truncado por limite de caracteres]'
      : transcriptText;

    // ===== BUILD PROMPT (optimized for speed) =====
    const isFast = mode === 'fast';
    
    const systemPrompt = `Você é um assistente clínico em PT-BR. Gere laudos estruturados sem diagnóstico definitivo. Produza DUAS hipóteses: mais provável e menos provável (diferencial). Para cada: racional, achados de suporte, achados contra, fatores de risco, probabilidade (Alta/Média/Baixa) e próximos passos. Liste red flags, lacunas de dados e CID-10 sugeridos. Se algo não constar, marque "não informado". Inclua disclaimer: "Conteúdo gerado por IA para apoio; não substitui avaliação clínica." LGPD: use apenas iniciais/idade/sexo.${isFast ? '' : ' Ao final inclua Embasamento Teórico com referências a diretrizes médicas brasileiras (máximo 300 palavras).'}

FORMATO: Retorne APENAS JSON válido (sem markdown fences). Campos:
1. dados_paciente: {iniciais, sexo, idade, especialidade}
2. resumo_clinico: string (máximo 150 palavras)
3. hipoteses: {mais_provavel: {descricao, probabilidade, racional, achados_suporte[], achados_contra[], fatores_risco[], proximos_passos[]}, menos_provavel: {idem}}
4. condutas_recomendadas: string[] (máximo 8 itens)
5. exames_sugeridos: string[] (máximo 6 itens)
6. red_flags: string[] (máximo 5 itens)
7. lacunas_dados: string[] (máximo 5 itens)
8. cid10_sugeridos: string[] (máximo 4 itens)
9. texto_laudo_md: string (laudo em Markdown, máximo ${isFast ? '600' : '800'} palavras)
10. texto_paciente_md: string (resumo acessível, máximo 120 palavras)
11. avisos_legais: string
${isFast ? '' : '12. embasamento_teorico: {diretrizes: string[], fundamentacao: string, protocolos: string[]} (máximo 300 palavras total)'}

CRÍTICO: Seja conciso. Retorne APENAS JSON válido.`;

    const userPrompt = `PACIENTE: ${patient?.iniciais || 'N/I'}, ${patient?.sexo || 'N/I'}, ${patient?.idade || 'N/I'} anos
ESPECIALIDADE: ${specialty || 'N/E'}
QUEIXA: ${chief_complaint || 'N/I'}
TRANSCRIÇÃO: ${truncatedTranscript || 'Não fornecida'}
SINAIS VITAIS: ${vitals ? Object.entries(vitals).map(([k, v]) => `${k}:${v}`).join(', ') : 'N/I'}
MEDICAÇÕES: ${meds?.length ? meds.join(', ') : 'N/I'}
ALERGIAS: ${allergies?.length ? allergies.join(', ') : 'N/I'}
EXAME FÍSICO: ${exam_findings || 'N/I'}
CONTEXTO: ${contexto_clinico || 'N/I'}
HISTÓRICO: ${historico || 'N/I'}
HIPÓTESES PRÉVIAS: ${hipoteses_previas?.length ? hipoteses_previas.join(', ') : 'N/I'}`;

    const promptChars = systemPrompt.length + userPrompt.length;
    const maxTokens = isFast ? 4000 : 6000;
    const modelUsed = 'google/gemini-2.5-flash';

    log(cid, 'llm_start', {
      laudo_id, model: modelUsed, mode, prompt_chars: promptChars,
      transcript_chars: transcriptText.length, max_tokens: maxTokens,
    });

    // ===== LLM CALL =====
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('Lovable AI não configurada');

    const t4 = now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout (was 180s)

    let response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelUsed,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        log(cid, 'timeout', { after_ms: 60000 });
        throw new Error('Tempo limite excedido (60s). Tente novamente.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    const t5 = now();
    const llmLatency = t5 - t4;

    if (!response.ok) {
      log(cid, 'llm_error', { status: response.status, llm_ms: llmLatency });
      await response.text(); // consume body
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente em alguns minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Erro na IA: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    const usage = data.usage;
    const finishReason = data.choices?.[0]?.finish_reason;

    log(cid, 'llm_done', {
      llm_ms: llmLatency, tokens: usage?.total_tokens,
      finish_reason: finishReason, content_len: content?.length,
    });

    if (!content) {
      throw new Error('Resposta vazia da IA.');
    }

    // ===== PARSE JSON (robust) =====
    let laudoData;
    const t6 = now();

    try {
      // Strip markdown fences and control chars
      let clean = content
        .replace(/^```(?:json)?\s*/gm, '')
        .replace(/```\s*$/gm, '')
        .trim();
      clean = clean.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      
      // Handle truncated JSON from finish_reason=length
      if (finishReason === 'length' && !clean.endsWith('}')) {
        // Try to close the JSON
        const openBraces = (clean.match(/{/g) || []).length;
        const closeBraces = (clean.match(/}/g) || []).length;
        const missing = openBraces - closeBraces;
        if (missing > 0) {
          // Close any open strings/arrays
          if (clean.match(/:\s*"[^"]*$/)) clean += '"';
          if (clean.match(/\[[^\]]*$/)) clean += ']';
          clean += '}'.repeat(missing);
        }
      }
      
      laudoData = JSON.parse(clean);
      log(cid, 'parse_ok', { ms: now() - t6 });
    } catch (parseError) {
      log(cid, 'parse_fail', { content_len: content?.length, finish_reason: finishReason });
      
      // Recovery: ask LLM to fix JSON (short prompt, cheap)
      const fixResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'Corrija o JSON abaixo para que seja válido. Retorne APENAS o JSON corrigido, sem explicações.' },
            { role: 'user', content: content.substring(0, 8000) }
          ],
          max_tokens: 4000,
          temperature: 0.1,
        }),
      });

      if (fixResp.ok) {
        const fixData = await fixResp.json();
        const fixContent = fixData.choices?.[0]?.message?.content;
        if (fixContent) {
          let cleanFix = fixContent.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
          cleanFix = cleanFix.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');
          try {
            laudoData = JSON.parse(cleanFix);
            log(cid, 'fix_parse_ok');
          } catch {
            log(cid, 'fix_parse_fail');
            throw new Error('Formato de resposta inválido da IA. Tente novamente.');
          }
        } else {
          throw new Error('Resposta vazia na recuperação.');
        }
      } else {
        await fixResp.text(); // consume
        throw new Error('Falha na recuperação do JSON.');
      }
    }

    // ===== DEFAULTS =====
    if (!laudoData.avisos_legais) {
      laudoData.avisos_legais = 'Conteúdo gerado por IA para apoio à decisão clínica. Não substitui julgamento médico profissional.';
    }

    // ===== DB UPDATE =====
    const t7 = now();
    const { error: updateError } = await supabase
      .from('laudos')
      .update({
        patient_data: laudoData.dados_paciente || patient,
        clinical_context: { specialty, chief_complaint, vitals, meds, allergies, exam_findings, contexto_clinico, historico, hipoteses_previas },
        summary: { resumo_clinico: laudoData.resumo_clinico },
        hypotheses: laudoData.hipoteses,
        conducts: laudoData.condutas_recomendadas,
        complementary_exams: laudoData.exames_sugeridos,
        red_flags: laudoData.red_flags,
        cid10_codes: laudoData.cid10_sugeridos,
        report_markdown: laudoData.texto_laudo_md,
        patient_markdown: laudoData.texto_paciente_md,
        legal_disclaimer: laudoData.avisos_legais,
        ai_model: modelUsed,
        ai_usage: {
          prompt_tokens: usage?.prompt_tokens,
          completion_tokens: usage?.completion_tokens,
          total_tokens: usage?.total_tokens,
          latency_ms: llmLatency,
          latency_total_ms: now() - t0,
          finish_reason: finishReason,
          correlation_id: cid,
          mode,
        },
        generation_mode: mode,
        last_update_type: 'complete',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', laudo_id)
      .eq('user_id', user.id);

    if (updateError) {
      log(cid, 'db_error', { error: updateError.message });
      throw new Error('Erro ao salvar laudo.');
    }

    const t8 = now();
    log(cid, 'complete', {
      laudo_id, model: modelUsed, mode,
      tokens: usage?.total_tokens,
      llm_ms: llmLatency,
      total_ms: t8 - t0,
      t_auth: t1 - t0,
      t_checks: t2 - t1,
      t_llm: llmLatency,
      t_parse: t7 - t5,
      t_db: t8 - t7,
    });

    return new Response(JSON.stringify({
      success: true,
      laudo: laudoData,
      metadata: {
        model: modelUsed, mode, usage,
        latency_ms: t8 - t0, llm_ms: llmLatency,
        finish_reason: finishReason, correlation_id: cid,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    log(cid, 'error', {
      message: error instanceof Error ? error.message : 'unknown',
      laudo_id: currentLaudoId, total_ms: now() - t0,
    });

    // Mark laudo as error
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && currentLaudoId) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } }
        });
        await supabase.from('laudos').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', currentLaudoId);
      }
    } catch { /* best effort */ }

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      correlation_id: cid,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
