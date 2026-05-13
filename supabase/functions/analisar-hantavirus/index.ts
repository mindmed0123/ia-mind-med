// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINTOMAS_LABELS: Record<string, string> = {
  febre: "Febre (≥38°C)", cefaleia: "Cefaleia intensa",
  mialgia: "Mialgia (dores musculares)", dor_lombar: "Dor lombar",
  dor_abdominal: "Dor abdominal", nausea: "Náusea", vomito: "Vômito",
  diarreia: "Diarreia", fadiga: "Fadiga/prostração",
  rubor_facial: "Rubor facial", olhos_vermelhos: "Olhos vermelhos/conjuntivite",
  petequias: "Petéquias (manchas vermelhas na pele)",
  tosse_seca: "Tosse seca", dispneia: "Dispneia (falta de ar)",
  hipotensao: "Hipotensão", taquicardia: "Taquicardia",
};

const FATORES_LABELS: Record<string, string> = {
  contato_roedores: "Contato com roedores ou fezes de roedores",
  area_rural: "Trabalho/residência em área rural",
  viagem_endemica: "Viagem recente para área endêmica (Patagônia/Sul do Brasil)",
  contato_caso_confirmado: "Contato com caso confirmado de Hantavírus",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { sintomas, fatores_epidemiologicos, descricao_sintomas, imagens_urls, patient_name } =
      await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const sintomasPresentes = Object.entries(sintomas || {})
      .filter(([_, v]) => v === true)
      .map(([k]) => SINTOMAS_LABELS[k] || k);
    const fatoresPresentes = Object.entries(fatores_epidemiologicos || {})
      .filter(([_, v]) => v === true)
      .map(([k]) => FATORES_LABELS[k] || k);

    const systemPrompt = `Você é um sistema de auxílio diagnóstico clínico especializado em doenças infecciosas emergentes, com expertise em Hantavírus, integrado à plataforma MindMed.

IMPORTANTE: Você é um AUXILIAR diagnóstico — não substitui o médico.

Contexto epidemiológico atual (maio 2026):
- Surto ativo do vírus Andes no navio MV Hondius (9 casos confirmados, 3 mortes)
- O vírus Andes é o ÚNICO hantavírus com transmissão humano-humano
- Brasil: 7 casos em 2026
- Mortalidade: ~40% nos casos de Síndrome Pulmonar por Hantavírus (SPH)

Critérios de suspeita:
- ALTA: febre + mialgia intensa + dor lombar + exposição a roedores OU contato com caso confirmado
- CUTÂNEAS: petéquias no tronco, rubor facial, conjuntiva injetada
- ALARME: tosse seca, dispneia em paciente com fase prodrômica
- CRÍTICO: dispneia + hipotensão + fase prodrômica = emergência

Retorne APENAS um JSON com esta estrutura exata:
{
  "probabilidade": <0-100>,
  "classificacao": "baixo"|"moderado"|"alto"|"critico",
  "analise_clinica": "<150-300 palavras>",
  "analise_imagem": "<análise das imagens ou 'Nenhuma imagem fornecida.'>",
  "recomendacoes": [<até 6>],
  "diferenciais": [<até 4>]
}

Faixas: 0-29 baixo, 30-59 moderado, 60-84 alto, 85-100 crítico.`;

    const userContent: any[] = [
      {
        type: "text",
        text: `TRIAGEM DE HANTAVÍRUS — PACIENTE: ${patient_name}

SINTOMAS PRESENTES (${sintomasPresentes.length} de 16):
${sintomasPresentes.length ? sintomasPresentes.map((s) => `• ${s}`).join("\n") : "• Nenhum sintoma marcado"}

FATORES EPIDEMIOLÓGICOS:
${fatoresPresentes.length ? fatoresPresentes.map((f) => `• ${f}`).join("\n") : "• Nenhum fator de risco relatado"}

${descricao_sintomas ? `DESCRIÇÃO ADICIONAL DO MÉDICO:\n"${descricao_sintomas}"` : ""}

${imagens_urls?.length ? `IMAGENS DE LESÕES CUTÂNEAS: ${imagens_urls.length} imagem(ns) enviada(s)` : "IMAGENS: Nenhuma."}

Analise este caso e retorne o JSON.`,
      },
    ];

    if (imagens_urls?.length) {
      for (const url of imagens_urls.slice(0, 4)) {
        userContent.push({ type: "image_url", image_url: { url, detail: "high" } });
      }
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 1500,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const openaiData = await openaiRes.json();
    const rawContent = openaiData.choices?.[0]?.message?.content || "{}";
    const resultado = JSON.parse(rawContent);

    const probabilidade = Math.max(0, Math.min(100, Number(resultado.probabilidade) || 0));
    let classificacao = resultado.classificacao || "baixo";
    if (!["baixo", "moderado", "alto", "critico"].includes(classificacao)) {
      classificacao =
        probabilidade >= 85 ? "critico" :
        probabilidade >= 60 ? "alto" :
        probabilidade >= 30 ? "moderado" : "baixo";
    }

    return new Response(
      JSON.stringify({
        probabilidade,
        classificacao,
        analise_ia: resultado.analise_clinica || "",
        analise_imagem_ia: resultado.analise_imagem || "Nenhuma imagem fornecida.",
        recomendacoes_ia: Array.isArray(resultado.recomendacoes) ? resultado.recomendacoes : [],
        diferenciais_ia: Array.isArray(resultado.diferenciais) ? resultado.diferenciais : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("analisar-hantavirus error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
