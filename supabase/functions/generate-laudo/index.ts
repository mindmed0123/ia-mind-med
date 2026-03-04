import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured logger - never logs PHI/PII
function log(correlationId: string, step: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), cid: correlationId, step, ...data };
  console.log(JSON.stringify(entry));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  let currentLaudoId: string | null = null;

  try {
    log(correlationId, 'start');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwtMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!jwtMatch) {
      return new Response(JSON.stringify({ error: 'Formato de autorização inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jwt = jwtMatch[1];

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log(correlationId, 'auth_ok', { uid: user.id.substring(0, 8) });

    const {
      patient,
      specialty,
      chief_complaint,
      transcript,
      vitals,
      meds,
      allergies,
      exam_findings,
      contexto_clinico,
      historico,
      hipoteses_previas,
      laudo_id,
      mode = 'fast'
    } = await req.json();

    currentLaudoId = laudo_id;

    // ===== IDEMPOTENCY CHECK =====
    // Prevent double-submit: if laudo is already completed or being generated, skip
    const { data: existingLaudo } = await supabase
      .from('laudos')
      .select('status, updated_at')
      .eq('id', laudo_id)
      .eq('user_id', user.id)
      .single();

    if (existingLaudo?.status === 'completed') {
      log(correlationId, 'idempotent_skip', { laudo_id, status: 'completed' });
      return new Response(JSON.stringify({
        success: true,
        idempotent: true,
        message: 'Laudo já foi gerado anteriormente.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== RATE LIMITING =====
    // Max 5 laudo generations per user per minute
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentCount } = await supabase
      .from('laudos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('updated_at', oneMinuteAgo);

    if (recentCount !== null && recentCount >= 5) {
      log(correlationId, 'rate_limited', { uid: user.id.substring(0, 8), count: recentCount });
      return new Response(JSON.stringify({
        error: 'Limite de requisições atingido. Aguarde 1 minuto antes de gerar outro laudo.',
        retry_after: 60,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    log(correlationId, 'rate_check_ok', { recent: recentCount });

    const systemPrompt = `Você é um assistente clínico em PT-BR. Gere **laudos estruturados** sem diagnóstico definitivo, explicitando incertezas. Sempre produza **duas hipóteses**: **Mais provável** e **Menos provável (diferencial)**. Para cada hipótese, liste: **racional** (com base na transcrição e dados informados), **achados de suporte**, **achados que contrariam**, **fatores de risco**, **probabilidade (Alta/Média/Baixa)** e **próximos passos** (condutas e exames). Liste **red flags**, **lacunas de dados** (perguntas que faltam) e **CID‑10 sugeridos** (indicativos). Se algo não estiver na transcrição/dados, marque **"não informado"** (não invente). Inclua **disclaimer**: "Conteúdo gerado por IA para apoio; não substitui avaliação clínica presencial e julgamento médico." Siga **LGPD by design**: restrinja identificadores a iniciais/idade/sexo; não registre dados sensíveis desnecessários; minimize. Evite alucinações.

IMPORTANTE: Ao final do laudo, inclua uma seção de **Embasamento Teórico** com:
- Referências a diretrizes médicas relevantes (Ministério da Saúde, sociedades médicas brasileiras)
- Fundamentação científica para as hipóteses diagnósticas
- Base teórica para as condutas recomendadas
- Se aplicável, mencione protocolos clínicos estabelecidos`;

    const userPrompt = `
**DADOS DO PACIENTE:**
- Iniciais: ${patient?.iniciais || 'N/I'}
- Sexo: ${patient?.sexo || 'N/I'}
- Idade: ${patient?.idade || 'N/I'}

**ESPECIALIDADE:** ${specialty || 'Não especificada'}

**QUEIXA PRINCIPAL:** ${chief_complaint || 'Não informada'}

**TRANSCRIÇÃO DA CONSULTA:**
${transcript || 'Não fornecida'}

**SINAIS VITAIS:**
${vitals ? Object.entries(vitals).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'Não informados'}

**MEDICAÇÕES EM USO:**
${meds?.length ? meds.map((m: string) => `- ${m}`).join('\n') : 'Nenhuma informada'}

**ALERGIAS:**
${allergies?.length ? allergies.map((a: string) => `- ${a}`).join('\n') : 'Nenhuma informada'}

**ACHADOS DO EXAME FÍSICO:**
${exam_findings || 'Não informados'}

**CONTEXTO CLÍNICO:**
${contexto_clinico || 'Não informado'}

**HISTÓRICO:**
${historico || 'Não informado'}

**HIPÓTESES PRÉVIAS:**
${hipoteses_previas?.length ? hipoteses_previas.map((h: string) => `- ${h}`).join('\n') : 'Nenhuma informada'}

**INSTRUÇÕES DE FORMATAÇÃO:**
Retorne um JSON estruturado com os seguintes campos:
1. dados_paciente: object - {iniciais, sexo, idade, especialidade}
2. resumo_clinico: string - Resumo objetivo do caso
3. hipoteses: object com:
   - mais_provavel: {descricao, probabilidade, racional, achados_suporte[], achados_contra[], fatores_risco[], proximos_passos[], trechos_timestamp[]}
   - menos_provavel: {descricao, probabilidade, racional, achados_suporte[], achados_contra[], fatores_risco[], proximos_passos[], trechos_timestamp[]}
4. condutas_recomendadas: array - Lista de condutas recomendadas
5. exames_sugeridos: array - Lista de exames sugeridos
6. red_flags: array - Sinais de alerta importantes
7. lacunas_dados: array - Perguntas/dados que faltam
8. cid10_sugeridos: array - Códigos CID-10 sugeridos
9. texto_laudo_md: string - Laudo completo em Markdown (incluir seção de Embasamento Teórico ao final)
10. texto_paciente_md: string - Resumo acessível ao paciente
11. avisos_legais: string - Disclaimer padrão
12. referencias: array - Referências e diretrizes utilizadas
13. embasamento_teorico: object - {diretrizes: string[], fundamentacao: string, protocolos: string[]}

IMPORTANTE: 
- Retorne APENAS o JSON, sem texto adicional antes ou depois.
- A seção embasamento_teorico deve conter fundamentação científica real baseada em diretrizes médicas brasileiras.
- Inclua o embasamento teórico também no texto_laudo_md como última seção.
`;

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable AI não configurada');
    }

    const startTime = Date.now();
    let modelUsed = 'google/gemini-2.5-flash';

    // Mark laudo as generating to prevent double-submit
    await supabase
      .from('laudos')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', laudo_id)
      .eq('user_id', user.id);

    log(correlationId, 'ai_request_start', { model: modelUsed, laudo_id });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    let response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 16000
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        log(correlationId, 'timeout', { after_ms: 180000 });
        throw new Error('Tempo limite de geração excedido. Tente novamente.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;
    log(correlationId, 'ai_response', { status: response.status, latency_ms: latencyMs });

    if (!response.ok) {
      const errorText = await response.text();
      log(correlationId, 'ai_error', { status: response.status });
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de requisições atingido. Tente novamente em alguns minutos.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Créditos insuficientes. Entre em contato com o suporte.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Erro na geração do laudo: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    let usage = data.usage;
    let finishReason = data.choices?.[0]?.finish_reason;

    log(correlationId, 'ai_content_received', { 
      tokens: usage?.total_tokens, 
      finish_reason: finishReason,
      content_length: content?.length 
    });

    if (!content || finishReason === 'length') {
      log(correlationId, 'fallback_start', { reason: !content ? 'empty' : 'length_capped' });
      const fallbackResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: systemPrompt + ' Seja conciso. Limite texto_laudo_md a 700 palavras e texto_paciente_md a 150 palavras. Retorne APENAS JSON válido.' },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 8000
        }),
      });

      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();
        content = fallbackData.choices?.[0]?.message?.content;
        usage = fallbackData.usage;
        finishReason = fallbackData.choices?.[0]?.finish_reason;
        modelUsed = 'google/gemini-2.5-flash-lite';
        log(correlationId, 'fallback_ok', { model: modelUsed });
      } else {
        const fbErr = await fallbackResp.text();
        log(correlationId, 'fallback_error', { status: fallbackResp.status });
      }
    }

    if (!content) {
      log(correlationId, 'empty_after_fallback');
      throw new Error('Resposta vazia da IA. Verifique se a API key está configurada corretamente.');
    }

    // Parse JSON from AI response
    let laudoData;
    try {
      let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      cleanContent = cleanContent.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      laudoData = JSON.parse(cleanContent);
      log(correlationId, 'parse_ok');
    } catch (parseError) {
      log(correlationId, 'parse_error', { content_length: content?.length });
      
      // Recovery attempt
      log(correlationId, 'recovery_start');
      const recoveryResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: systemPrompt + ' CRÍTICO: Seja MUITO conciso. Máximo 500 palavras em texto_laudo_md. Retorne APENAS JSON válido.' },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 6000
        }),
      });
      
      if (recoveryResp.ok) {
        const recoveryData = await recoveryResp.json();
        const recoveryContent = recoveryData.choices?.[0]?.message?.content;
        if (recoveryContent) {
          let cleanRecovery = recoveryContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          cleanRecovery = cleanRecovery.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');
          try {
            laudoData = JSON.parse(cleanRecovery);
            modelUsed = 'google/gemini-2.5-flash-lite (recovery)';
            log(correlationId, 'recovery_ok');
          } catch (retryError) {
            log(correlationId, 'recovery_parse_fail');
            throw new Error('Formato de resposta inválido da IA após tentativa de recuperação');
          }
        } else {
          throw new Error('Resposta vazia na tentativa de recuperação');
        }
      } else {
        throw new Error('Formato de resposta inválido da IA e falha na recuperação');
      }
    }

    // Add legal disclaimer if not present
    if (!laudoData.avisos_legais) {
      laudoData.avisos_legais = 'Este conteúdo foi gerado por inteligência artificial como ferramenta de apoio à decisão clínica. Não substitui o julgamento clínico profissional, a avaliação presencial do paciente ou exames complementares. O médico assistente é o único responsável pelas decisões diagnósticas e terapêuticas.';
    }

    // Update laudo in database
    const { error: updateError } = await supabase
      .from('laudos')
      .update({
        patient_data: laudoData.dados_paciente || patient,
        clinical_context: {
          specialty,
          chief_complaint,
          vitals,
          meds,
          allergies,
          exam_findings,
          contexto_clinico,
          historico,
          hipoteses_previas,
        },
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
          latency_ms: latencyMs,
          finish_reason: finishReason,
          correlation_id: correlationId,
        },
        generation_mode: mode,
        last_update_type: mode === 'delta' ? 'patient_data' : 'complete',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', laudo_id)
      .eq('user_id', user.id);

    if (updateError) {
      log(correlationId, 'db_update_error', { error: updateError.message });
      throw new Error('Erro ao salvar laudo no banco de dados');
    }

    log(correlationId, 'complete', {
      laudo_id,
      model: modelUsed,
      tokens: usage?.total_tokens,
      latency_ms: latencyMs,
    });

    return new Response(JSON.stringify({
      success: true,
      laudo: laudoData,
      metadata: {
        model: modelUsed,
        usage,
        latency_ms: latencyMs,
        finish_reason: finishReason,
        correlation_id: correlationId,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    log(correlationId, 'error', { 
      message: error instanceof Error ? error.message : 'unknown',
      laudo_id: currentLaudoId,
    });
    
    // Update laudo status to error
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && currentLaudoId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        await supabase
          .from('laudos')
          .update({ 
            status: 'error',
            updated_at: new Date().toISOString() 
          })
          .eq('id', currentLaudoId);
      }
    } catch (updateError) {
      log(correlationId, 'error_status_update_fail');
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      correlation_id: correlationId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});