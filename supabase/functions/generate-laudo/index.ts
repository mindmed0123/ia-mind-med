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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
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
      laudo_id
    } = await req.json();

    const systemPrompt = `Você é um redator médico assistivo. Gere **laudo estruturado** em PT-BR, **sem diagnóstico definitivo**, descrevendo incertezas. Jamais invente dados ausentes; sinalize como 'não informado'. Adote tom técnico conciso. Mantenha **conformidade LGPD**: não inclua identificadores além das iniciais/idade/sexo fornecidos. Proponha **hipóteses diferenciais** com justificativas. Liste **condutas** e **exames complementares** razoáveis, citando **red flags**. Sugerir **CID-10** quando apropriado (indicativo). Finalize com **disclaimer**: 'Conteúdo gerado por IA para apoio; não substitui avaliação clínica'. Se a transcrição for pobre/ruidosa, peça dados adicionais.`;

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
1. resumo_clinico: string - Resumo objetivo do caso
2. hipoteses: array - Lista de hipóteses com {descricao, probabilidade (Alta/Média/Baixa), justificativa}
3. condutas: array - Lista de condutas recomendadas
4. exames_complementares: array - Lista de exames sugeridos
5. red_flags: array - Sinais de alerta importantes
6. cid10_sugeridos: array - Códigos CID-10 sugeridos com descrição
7. texto_laudo_md: string - Laudo completo em Markdown formatado com seções
8. texto_paciente_md: string - Resumo em linguagem acessível ao paciente
9. avisos_legais: string - Disclaimer padrão
10. referencias: array - Referências bibliográficas se aplicável

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional antes ou depois.
`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const startTime = Date.now();

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
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
    const content = data.choices?.[0]?.message?.content;
    const usage = data.usage;
    const finishReason = data.choices?.[0]?.finish_reason;

    if (!content) {
      throw new Error('Resposta vazia da IA');
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
        patient_data: patient,
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
        conducts: laudoData.condutas,
        complementary_exams: laudoData.exames_complementares,
        red_flags: laudoData.red_flags,
        cid10_codes: laudoData.cid10_sugeridos,
        report_markdown: laudoData.texto_laudo_md,
        patient_markdown: laudoData.texto_paciente_md,
        legal_disclaimer: laudoData.avisos_legais,
        ai_model: 'google/gemini-2.5-pro',
        ai_usage: {
          prompt_tokens: usage?.prompt_tokens,
          completion_tokens: usage?.completion_tokens,
          total_tokens: usage?.total_tokens,
          latency_ms: latencyMs,
          finish_reason: finishReason,
        },
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
      model: 'google/gemini-2.5-pro',
      tokens: usage?.total_tokens,
      latency_ms: latencyMs,
      finish_reason: finishReason,
    });

    return new Response(JSON.stringify({
      success: true,
      laudo: laudoData,
      metadata: {
        model: 'google/gemini-2.5-pro',
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