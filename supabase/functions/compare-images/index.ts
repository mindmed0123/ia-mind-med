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

    const { 
      image1Url, 
      image2Url, 
      image1Date, 
      image2Date, 
      image1Category, 
      image2Category,
      patientName 
    } = await req.json();

    if (!image1Url || !image2Url) {
      return new Response(
        JSON.stringify({ error: 'Both image URLs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Comparing images for patient:', patientName);

    // Format dates
    const date1 = new Date(image1Date).toLocaleDateString('pt-BR');
    const date2 = new Date(image2Date).toLocaleDateString('pt-BR');

    // Call Lovable AI with both images
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
            content: `Você é um especialista em análise comparativa de imagens médicas.

Sua tarefa é comparar duas imagens médicas do mesmo paciente em datas diferentes para avaliar a evolução clínica.

Ao comparar as imagens, você deve:
1. Identificar mudanças visíveis entre as duas imagens
2. Avaliar se houve melhora, piora ou estabilização
3. Descrever especificamente o que mudou
4. Quantificar as mudanças quando possível (%, tamanho, intensidade)
5. Correlacionar com possíveis tratamentos ou evolução natural
6. Fornecer uma conclusão sobre a evolução

FORMATO DA RESPOSTA:
- Use linguagem clara e profissional em português
- Estruture em parágrafos
- Mencione as datas de cada imagem
- Seja objetivo mas completo
- Inclua observações sobre prognóstico quando relevante

IMPORTANTE: Esta análise é um auxílio ao médico e não substitui avaliação profissional.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Compare estas duas imagens médicas do paciente ${patientName || ''}:

IMAGEM 1:
- Data: ${date1}
- Categoria: ${image1Category || 'não especificada'}

IMAGEM 2:
- Data: ${date2}
- Categoria: ${image2Category || 'não especificada'}

Faça uma análise comparativa detalhada da evolução entre estas duas imagens.`
              },
              {
                type: 'image_url',
                image_url: { url: image1Url }
              },
              {
                type: 'image_url',
                image_url: { url: image2Url }
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
    const comparison = aiData.choices?.[0]?.message?.content || 'Não foi possível realizar a comparação.';

    console.log('Image comparison completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        comparison,
        metadata: {
          image1Date: date1,
          image2Date: date2,
          image1Category,
          image2Category,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compare-images:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
