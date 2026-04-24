// Map step of the map-reduce pipeline for long consultations.
// Receives the transcript text of a single chunk (3-5 minutes of speech),
// produces a structured clinical mini-summary that will later be consolidated
// into the final laudo. Keeps each call small and fast (≈3-6s with Flash-Lite).
//
// The output is intentionally compact: bullet-style strings the consolidator
// can concatenate without re-reading the entire raw transcript.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { callLlmWithFallback } from "../_shared/llm-call.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function log(cid: string, step: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "summarize-chunk", cid, step, ...data }));
}

const SUMMARY_TOOL = {
  type: "function",
  function: {
    name: "chunk_summary",
    description: "Resumo clínico estruturado de um trecho de consulta médica.",
    parameters: {
      type: "object",
      properties: {
        topicos: {
          type: "array",
          description: "3-6 tópicos clínicos mencionados neste trecho (sintomas, achados, condutas discutidas).",
          items: { type: "string" },
        },
        sintomas: { type: "array", items: { type: "string" } },
        medicacoes: { type: "array", items: { type: "string" } },
        alergias: { type: "array", items: { type: "string" } },
        comorbidades: { type: "array", items: { type: "string" } },
        achados_exame: { type: "array", items: { type: "string" } },
        sinais_vitais: { type: "object", additionalProperties: { type: "string" } },
        condutas_discutidas: { type: "array", items: { type: "string" } },
        red_flags: { type: "array", items: { type: "string" } },
        observacoes: { type: "string", description: "Contexto adicional relevante em até 200 chars." },
      },
      required: ["topicos"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const cid = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const jwt = authHeader.slice(7);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const text = String(body.text || "").trim();
    const chunkIndex = Number(body.chunk_index ?? -1);

    if (!text) {
      return new Response(JSON.stringify({ error: "text é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI não configurada");

    log(cid, "summarize_start", { chunkIndex, chars: text.length });

    const truncated = text.length > 4500 ? text.slice(0, 4500) + "..." : text;

    const result = await callLlmWithFallback(
      apiKey,
      {
        model: "google/gemini-2.5-flash-lite",
        fallbackModel: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente clínico. Recebe um trecho de uma consulta médica gravada (3-5 min) e produz um resumo estruturado em PT-BR. Seja conciso. Não invente dados que não estão no trecho.",
          },
          {
            role: "user",
            content: `Trecho ${chunkIndex >= 0 ? `#${chunkIndex + 1}` : ""} da consulta:\n\n${truncated}`,
          },
        ],
        tools: [SUMMARY_TOOL],
        toolChoice: { type: "function", function: { name: "chunk_summary" } },
        maxTokens: 1200,
        temperature: 0.1,
        timeoutMs: 45000,
        retries: 1,
      },
      (step, data) => log(cid, step, { chunkIndex, ...data }),
    );

    const choice = result.data.choices?.[0];
    const tc = choice?.message?.tool_calls?.[0];
    let summary: any = null;
    if (tc?.function?.arguments) {
      try {
        summary = JSON.parse(tc.function.arguments);
      } catch {
        summary = null;
      }
    }
    if (!summary) {
      // Last-resort: keep the raw text as a single observation
      summary = { topicos: [truncated.slice(0, 240)] };
    }

    log(cid, "summarize_done", {
      chunkIndex,
      model: result.modelUsed,
      fellBack: result.fellBack,
      ms: result.totalMs,
      topicos: Array.isArray(summary.topicos) ? summary.topicos.length : 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        chunk_index: chunkIndex,
        summary,
        model: result.modelUsed,
        fell_back: result.fellBack,
        latency_ms: result.totalMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log(cid, "error", { msg: err instanceof Error ? err.message : "unknown" });
    return new Response(
      JSON.stringify({ error: "Erro ao resumir trecho", error_id: cid }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
