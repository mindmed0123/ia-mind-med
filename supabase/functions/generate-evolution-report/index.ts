import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { patientId, patientName } = await req.json();

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'patientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating evolution report for patient:', patientId);

    // Fetch all patient data in parallel
    const [laudosRes, documentsRes, prescriptionsRes] = await Promise.all([
      supabase
        .from('laudos')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true }),
      supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('uploaded_at', { ascending: true }),
      supabase
        .from('prescriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ]);

    const laudos = laudosRes.data || [];
    const documents = documentsRes.data || [];
    const prescriptions = prescriptionsRes.data || [];

    // Build timeline data
    const timelineData: any[] = [];

    laudos.forEach(laudo => {
      timelineData.push({
        date: laudo.created_at,
        type: 'laudo',
        title: laudo.title || 'Laudo Médico',
        findings: laudo.diagnosis_main || laudo.specialty || 'Sem diagnóstico registrado',
      });
    });

    documents.forEach(doc => {
      timelineData.push({
        date: doc.uploaded_at,
        type: 'image',
        title: doc.file_name,
        findings: doc.ai_description || doc.category || 'Documento sem análise',
      });
    });

    // Sort by date
    timelineData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Prepare context for AI
    const contextSummary = `
HISTÓRICO DO PACIENTE: ${patientName}

LAUDOS (${laudos.length}):
${laudos.map(l => `
- Data: ${new Date(l.created_at).toLocaleDateString('pt-BR')}
- Título: ${l.title}
- Diagnóstico: ${l.diagnosis_main || 'N/A'}
- Especialidade: ${l.specialty || 'N/A'}
`).join('\n')}

IMAGENS E DOCUMENTOS (${documents.length}):
${documents.map(d => `
- Data: ${new Date(d.uploaded_at).toLocaleDateString('pt-BR')}
- Arquivo: ${d.file_name}
- Categoria: ${d.category}
- Análise IA: ${d.ai_description || 'Não analisado'}
`).join('\n')}

PRESCRIÇÕES (${prescriptions.length}):
${prescriptions.map(p => `
- Data: ${new Date(p.created_at).toLocaleDateString('pt-BR')}
- Medicamentos: ${((p.items as any[]) || []).map((i: any) => i.name || i.medication).join(', ')}
`).join('\n')}
`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate evolution report with AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em medicina que gera relatórios de evolução clínica.

Com base no histórico completo do paciente, você deve gerar um RELATÓRIO DE EVOLUÇÃO que inclua:

1. RESUMO DA EVOLUÇÃO: Análise da progressão do quadro clínico ao longo do tempo
2. PRINCIPAIS ACHADOS: Consolidação dos achados mais relevantes de laudos e imagens
3. ANÁLISE DE TENDÊNCIA: Se o paciente está melhorando, estável ou piorando
4. CORRELAÇÃO DE DADOS: Como os diferentes exames e laudos se relacionam
5. RECOMENDAÇÕES: Sugestões para acompanhamento baseadas na evolução
6. EMBASAMENTO TEÓRICO: Fundamentação científica para as conclusões

IMPORTANTE:
- Use linguagem médica profissional
- Seja objetivo e baseado em evidências
- Cite datas específicas quando relevante
- Não faça diagnósticos novos, apenas analise a evolução
- Inclua referências a guidelines quando apropriado

Responda em JSON com os campos:
{
  "evolution_summary": "texto do resumo da evolução",
  "key_findings": "principais achados consolidados",
  "trend_analysis": "análise de tendência",
  "recommendations": "recomendações",
  "theoretical_basis": "embasamento teórico"
}`
          },
          {
            role: 'user',
            content: `Gere um relatório de evolução completo para este paciente:\n\n${contextSummary}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseContent = aiData.choices?.[0]?.message?.content || '';

    console.log('AI Response for evolution report:', responseContent);

    // Parse JSON response
    let reportData;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reportData = JSON.parse(jsonMatch[0]);
      } else {
        reportData = {
          evolution_summary: responseContent,
          key_findings: '',
          recommendations: '',
          theoretical_basis: '',
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      reportData = {
        evolution_summary: responseContent,
        key_findings: '',
        recommendations: '',
        theoretical_basis: '',
      };
    }

    // Save report to database
    const { data: savedReport, error: saveError } = await supabase
      .from('evolution_reports')
      .insert({
        patient_id: patientId,
        user_id: user.id,
        title: `Relatório de Evolução - ${patientName} - ${new Date().toLocaleDateString('pt-BR')}`,
        timeline_data: timelineData,
        findings: { 
          laudos: laudos.length, 
          documents: documents.length, 
          prescriptions: prescriptions.length,
          key_findings: reportData.key_findings,
        },
        evolution_summary: reportData.evolution_summary,
        recommendations: reportData.recommendations,
        theoretical_basis: reportData.theoretical_basis,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving report:', saveError);
      throw saveError;
    }

    console.log('Evolution report saved:', savedReport.id);

    return new Response(
      JSON.stringify({ success: true, report: savedReport }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-evolution-report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
