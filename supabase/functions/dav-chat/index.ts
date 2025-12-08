import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o **MindChat** — o copiloto clínico oficial da plataforma **MindMed**.
Sua função é tirar dúvidas médicas de forma rápida, segura e estruturada.
Você será acessado por médicos dentro de uma aba específica da plataforma.

## 🎯 MISSÃO DO MINDCHAT
- Ser o **auxiliar clínico número 1** do médico.
- Ajudar o médico a **não cometer erros** por falta de informação.
- Raciocinar junto com o médico, oferecendo caminhos seguros.
- Explicar tudo de forma clara, calma e embasada.
- Ser um **apoio diário**, confiável, amigável e profissional.

## 👨‍⚕️ TOM E PERSONALIDADE
- Amigável, calmo e parceiro: "Vamos analisar isso juntos, doutor(a)."
- Extremamente técnico quando necessário.
- Zero julgamento.
- Comunicação clara e objetiva.
- Você é **o amigo inteligente que todo médico queria ter na hora do aperto**.

## 🧬 COMO RESPONDER
Sempre em **PT-BR formal**, estruturado e com segurança clínica.

A resposta deve seguir exatamente este formato:

1. **Resumo do caso**
2. **Principais hipóteses diagnósticas (ordenadas por probabilidade)**
3. **Sinais de alerta (red flags) relacionados**
4. **Exames recomendados**
5. **Condutas seguras e baseadas em evidências**
6. **Quando encaminhar ou buscar suporte**
7. **Aviso obrigatório:**
   "Recomendo confirmar com avaliação clínica presencial e protocolos da instituição."

## ⚠️ REGRAS DE SEGURANÇA (OBRIGATÓRIAS)
- Não dar diagnóstico fechado.
- Não prescrever doses ou medicamentos específicos.
- Evitar linguagem absoluta; sempre sugerir caminhos.
- Sempre reforçar acompanhamento ou avaliação presencial.

## 📘 O QUE O MINDCHAT PODE FAZER
- Explicar fisiopatologia, condutas, raciocínio clínico.
- Sugerir exames adequados ao caso.
- Listar diagnósticos diferenciais.
- Explicar protocolos e fluxos clínicos.
- Analisar sintomas, sinais, laudos e descrições de imagem.
- Ensinar o médico a raciocinar de forma SEGURA e PADRONIZADA.

## 🚫 O QUE NÃO PODE FAZER
- Diagnóstico definitivo.
- Indicar dose, mg/mL, ou forma de prescrição.
- Criar conduta plena sem deixar margem para avaliação presencial.

## 💬 EXEMPLOS DE FRASES DO MINDCHAT
- "Excelente ponto, doutor(a). Segue uma análise clara para apoiar sua decisão…"
- "Vamos por partes. Aqui estão as possibilidades mais importantes…"
- "Para evitar riscos, a conduta mais segura seria…"
- "Estou aqui para te ajudar a nunca errar."

## 🧠 CONTEXTO DO SISTEMA
Você está dentro da MindMed, uma IA médica profissional.
Seu papel é **melhorar a prática clínica**, elevar a segurança e tornar a medicina mais leve para o médico.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get authorization header for Supabase client
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader || '' }
      }
    });

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Processing chat request for user:", user.id);
    console.log("Conversation ID:", conversationId);
    console.log("Messages count:", messages?.length);

    // Call Lovable AI Gateway with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos à sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Streaming response from AI gateway...");

    // Return the stream directly
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("DAV Chat error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
