import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract JWT from "Bearer <token>"
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
      regras_produto,
      laudo_id,
      mode = 'complete'
    } = await req.json();

    const systemPrompt = `Você é um assistente clínico em PT-BR. Gere **laudos estruturados** sem diagnóstico definitivo, explicitando incertezas. Sempre produza **duas hipóteses**: **Mais provável** e **Menos provável (diferencial)**. Para cada hipótese, liste: **racional** (com base na transcrição e dados informados), **achados de suporte**, **achados que contrariam**, **fatores de risco**, **probabilidade (Alta/Média/Baixa)** e **próximos passos** (condutas e exames). Liste **red flags**, **lacunas de dados** (perguntas que faltam) e **CID‑10 sugeridos** (indicativos). Se algo não estiver na transcrição/dados, marque **"não informado"** (não invente). Inclua **disclaimer**: "Conteúdo gerado por IA para apoio; não substitui avaliação clínica presencial e julgamento médico." Siga **LGPD by design**: restrinja identificadores a iniciais/idade/sexo; não registre dados sensíveis desnecessários; minimize. Evite alucinações.`;

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
9. texto_laudo_md: string - Laudo completo em Markdown
10. texto_paciente_md: string - Resumo acessível ao paciente
11. avisos_legais: string - Disclaimer padrão
12. referencias: array - Referências se aplicável

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional antes ou depois.
`;

    const OPENAI_API_KEY = Deno.env.get('API_keys') || Deno.env.get('API_key') || Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('Chave da OpenAI não configurada');
    }

    const startTime = Date.now();
    let modelUsed = 'gpt-5';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4000,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
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
    console.log('OpenAI response structure:', JSON.stringify(data, null, 2));
    
    let content = data.choices?.[0]?.message?.content;
    let usage = data.usage;
    let finishReason = data.choices?.[0]?.finish_reason;

    if (!content || finishReason === 'length') {
      console.warn('Primary model returned empty/length-capped output. Falling back to gpt-5-mini with stricter limits.');
      const fallbackResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: systemPrompt + ' Seja conciso. Limite texto_laudo_md a 700 palavras e texto_paciente_md a 150 palavras. Retorne APENAS JSON válido.' },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 2000,
        }),
      });

      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();
        console.log('Fallback response structure:', JSON.stringify(fallbackData, null, 2));
        content = fallbackData.choices?.[0]?.message?.content;
        usage = fallbackData.usage;
        finishReason = fallbackData.choices?.[0]?.finish_reason;
        modelUsed = 'gpt-5-mini';
      } else {
        const fbErr = await fallbackResp.text();
        console.error('Fallback model error:', fallbackResp.status, fbErr);
      }
    }

    if (!content) {
      console.error('Empty AI response after fallback.');
      throw new Error('Resposta vazia da IA. Verifique se a API key está configurada corretamente.');
    }

    // Parse JSON from AI response
    let laudoData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      laudoData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Erro ao parsear JSON:', parseError);
      throw new Error('Formato de resposta inválido da IA');
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
        },
        generation_mode: mode,
        last_update_type: mode === 'delta' ? 'patient_data' : 'complete',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', laudo_id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Erro ao atualizar laudo:', updateError);
      throw new Error('Erro ao salvar laudo no banco de dados');
    }

    console.log('Laudo gerado com sucesso:', {
      laudo_id,
      model: modelUsed,
      tokens: usage?.total_tokens,
      latency_ms: latencyMs,
      finish_reason: finishReason,
    });

    return new Response(JSON.stringify({
      success: true,
      laudo: laudoData,
      metadata: {
        model: modelUsed,
        usage,
        latency_ms: latencyMs,
        finish_reason: finishReason,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função generate-laudo:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});