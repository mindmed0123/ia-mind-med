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
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const jwt = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await userClient.auth.getClaims(jwt);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = claims.claims.sub as string;

    const { documentId, imageUrl, patientName, patientId, medicalObservation, clinicalContext, transcriptText } = await req.json();

    if (!documentId || !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'documentId and imageUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user owns the document being analyzed
    const { data: doc, error: docErr } = await userClient
      .from('patient_documents')
      .select('id, user_id')
      .eq('id', documentId)
      .maybeSingle();
    if (docErr || !doc || doc.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }


    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Analyzing image for document:', documentId, 'has observation:', !!medicalObservation);

    // Build a richer user prompt that incorporates the doctor's observation,
    // clinical context and (optionally) the consultation transcript so the
    // model interprets the image WITH context, not in isolation.
    const contextParts: string[] = [];
    if (patientName) contextParts.push(`Paciente: ${patientName}`);
    if (clinicalContext) contextParts.push(`Contexto clínico: ${clinicalContext}`);
    if (transcriptText) contextParts.push(`Trecho da consulta:\n${String(transcriptText).slice(0, 2000)}`);
    if (medicalObservation) {
      contextParts.push(`Observação do médico sobre este exame:\n${medicalObservation}`);
    }
    const contextBlock = contextParts.length
      ? `\n\nContexto fornecido pelo médico:\n${contextParts.join('\n\n')}`
      : '';

    // Call Lovable AI with vision capabilities
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
            content: `Você é um assistente médico especializado em análise de imagens médicas.
            
Ao analisar uma imagem médica, você deve:
1. Identificar o tipo de exame/imagem (raio-X, tomografia, foto clínica, etc.)
2. Descrever os achados visuais principais de forma objetiva
3. Identificar possíveis anormalidades ou alterações
4. Sugerir correlações clínicas quando apropriado, **integrando a observação do médico e o contexto clínico fornecido**
5. Recomendar exames complementares se necessário

IMPORTANTE:
- Seja preciso e objetivo
- Use terminologia médica adequada
- Não faça diagnósticos definitivos, apenas descrições e hipóteses
- Quando houver observação do médico, leve-a em conta como a hipótese clínica principal e correlacione os achados visuais com ela.
- Sempre mencione a necessidade de avaliação médica profissional

Responda em português brasileiro no formato JSON:
{
  "description": "Descrição resumida da imagem em 1-2 frases",
  "image_type": "tipo de imagem identificado",
  "findings": "Achados visuais detalhados",
  "abnormalities": "Possíveis anormalidades identificadas",
  "clinical_correlation": "Correlação clínica sugerida (incorporando observação do médico se houver)",
  "recommendations": "Recomendações ou exames complementares",
  "confidence": "alto/médio/baixo"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta imagem médica do paciente ${patientName || 'não identificado'}. Forneça uma análise detalhada.${contextBlock}`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
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

    console.log('AI Response:', responseContent);

    // Parse JSON from response
    let analysis;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = {
          description: responseContent,
          findings: responseContent,
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      analysis = {
        description: responseContent.substring(0, 500),
        findings: responseContent,
      };
    }

    // Update document in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from('patient_documents')
      .update({
        ai_description: analysis.description,
        ai_analysis: analysis,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document:', updateError);
      throw updateError;
    }

    console.log('Image analysis completed for document:', documentId);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
