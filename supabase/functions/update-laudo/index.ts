// update-laudo: Incorporates additional information (manual exam description
// or doctor edits) into an existing laudo, preserving the original structure.
//
// Strategy:
// - Load current laudo
// - Snapshot previous version into sections._previous_version
// - Call Gemini Flash with strict instruction to update only the right fields
// - Save updated sections + report_markdown without losing prior content

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
  console.log(JSON.stringify({ ts: new Date().toISOString(), cid, step, ...data }));
}

const UPDATE_TOOL = {
  type: "function",
  function: {
    name: "update_laudo",
    description:
      "Atualiza laudo clínico existente incorporando informações adicionais nas seções corretas, sem duplicar nem remover conteúdo prévio.",
    parameters: {
      type: "object",
      properties: {
        sections: {
          type: "object",
          description:
            "Seções atualizadas do laudo. Inclua APENAS as seções que mudaram. Use as mesmas chaves do laudo atual: queixa, hda, isda, antecedentes_pessoais, antecedentes_familiares, habitos_de_vida, medicacoes_em_uso, sinais_vitais_texto, exame_fisico, hipoteses (com principal e diferencial), conduta, exames_complementares, observacoes, orientacoes.",
          properties: {
            queixa: { type: "string" },
            hda: { type: "string" },
            isda: { type: "string" },
            antecedentes_pessoais: { type: "string" },
            antecedentes_familiares: { type: "string" },
            habitos_de_vida: { type: "string" },
            medicacoes_em_uso: { type: "string" },
            sinais_vitais_texto: { type: "string" },
            exame_fisico: { type: "string" },
            hipoteses: {
              type: "object",
              properties: {
                principal: { type: "string" },
                diferencial: { type: "string" },
              },
            },
            conduta: { type: "string" },
            exames_complementares: { type: "string" },
            observacoes: { type: "string" },
            orientacoes: { type: "string" },
          },
          additionalProperties: true,
        },
        cid10_added: {
          type: "array",
          items: { type: "string" },
          description: "Novos códigos CID-10 a adicionar (sem duplicar existentes).",
        },
        red_flags_added: {
          type: "array",
          items: { type: "string" },
          description: "Novos sinais de alerta a adicionar (sem duplicar existentes).",
        },
        complementary_exams_added: {
          type: "array",
          items: { type: "string" },
          description: "Novos exames complementares a adicionar (sem duplicar).",
        },
        change_summary: {
          type: "string",
          description: "Breve descrição do que mudou (1 linha).",
        },
      },
      required: ["sections", "change_summary"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Você é um assistente clínico. Sua tarefa: atualizar um laudo médico existente incorporando APENAS as novas informações fornecidas pelo médico.

REGRAS ABSOLUTAS:
1. PRESERVE toda informação clínica relevante já existente no laudo.
2. NÃO duplique conteúdo — se a informação já está no laudo, não a repita.
3. NÃO recrie o laudo do zero.
4. Insira a nova informação na seção MAIS ADEQUADA:
   - Achados de exame físico → exame_fisico
   - Resultados de exames trazidos/imagens → exames_complementares (e observacoes se for achado contextual)
   - Novo sintoma ou evolução → hda
   - Mudança de raciocínio clínico → hipoteses.principal/diferencial e conduta
   - Orientações novas → orientacoes
   - Notas livres do médico → observacoes
5. Se a nova informação alterar hipóteses ou conduta, atualize essas seções de forma coerente, mantendo o que ainda for válido.
6. Se a informação já cabe em uma seção que tem texto, ANEXE ao texto existente de forma fluida (não substitua).
7. Idioma: Português (PT-BR), linguagem médica formal.
8. Retorne APENAS as seções que mudaram via tool call.`;

function buildPlainLaudo(laudo: any) {
  const s = laudo.sections || {};
  const lines: string[] = [];
  lines.push("=== LAUDO ATUAL ===");
  if (s.queixa) lines.push(`[Queixa]: ${s.queixa}`);
  if (s.hda) lines.push(`[HDA]: ${s.hda}`);
  if (s.exame_fisico) lines.push(`[Exame Físico]: ${s.exame_fisico}`);
  if (s.hipoteses?.principal) lines.push(`[Hipótese Principal]: ${s.hipoteses.principal}`);
  if (s.hipoteses?.diferencial) lines.push(`[Hipótese Diferencial]: ${s.hipoteses.diferencial}`);
  if (s.conduta) lines.push(`[Conduta]: ${s.conduta}`);
  if (s.exames_complementares) lines.push(`[Exames Complementares]: ${s.exames_complementares}`);
  if (s.orientacoes) lines.push(`[Orientações]: ${s.orientacoes}`);
  if (s.observacoes) lines.push(`[Observações]: ${s.observacoes}`);
  if (laudo.cid10_codes?.length) lines.push(`[CID-10]: ${laudo.cid10_codes.join(", ")}`);
  if (laudo.red_flags?.length) lines.push(`[Red Flags]: ${(laudo.red_flags as any[]).join(" | ")}`);
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cid = crypto.randomUUID();
  try {
    const body = await req.json();
    const { laudo_id, additional_info, source } = body || {};

    if (!laudo_id || typeof laudo_id !== "string") {
      return new Response(JSON.stringify({ error: "laudo_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!additional_info || typeof additional_info !== "string" || additional_info.trim().length < 3) {
      return new Response(JSON.stringify({ error: "additional_info required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    log(cid, "load_laudo", { laudo_id });
    const { data: laudo, error: loadErr } = await supabase
      .from("laudos")
      .select("*")
      .eq("id", laudo_id)
      .single();

    if (loadErr || !laudo) {
      return new Response(JSON.stringify({ error: "Laudo not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI key missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceLabel =
      source === "manual_exam"
        ? "Descrição manual de exame trazido pelo paciente"
        : source === "editor_edit"
          ? "Edição/complemento do médico"
          : "Informação adicional do médico";

    const userMsg = `${buildPlainLaudo(laudo)}

=== NOVA INFORMAÇÃO (origem: ${sourceLabel}) ===
${additional_info.trim()}

Atualize o laudo seguindo as regras. Devolva apenas seções modificadas via tool_call.`;

    log(cid, "llm_call_start");
    const result = await callLlmWithFallback(
      lovableKey,
      {
        model: "google/gemini-2.5-flash",
        fallbackModel: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [UPDATE_TOOL],
        toolChoice: { type: "function", function: { name: "update_laudo" } },
        maxTokens: 4000,
        temperature: 0.15,
        timeoutMs: 60000,
        retries: 1,
      },
      (step, data) => log(cid, step, data),
    );

    const toolCall = result.data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("LLM did not return a tool call");
    }
    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      throw new Error("Failed to parse LLM tool args");
    }

    const updatedSections = parsed.sections || {};
    const currentSections = (laudo.sections as any) || {};

    // Snapshot previous version
    const previousSnapshot = {
      sections: currentSections,
      cid10_codes: laudo.cid10_codes,
      red_flags: laudo.red_flags,
      complementary_exams: laudo.complementary_exams,
      report_markdown: laudo.report_markdown,
      saved_at: new Date().toISOString(),
    };

    // Merge: deep-merge for hipoteses, replace for the rest
    const mergedSections: any = { ...currentSections };
    for (const [key, value] of Object.entries(updatedSections)) {
      if (key === "hipoteses" && typeof value === "object" && value) {
        mergedSections.hipoteses = {
          ...(currentSections.hipoteses || {}),
          ...(value as any),
        };
      } else {
        mergedSections[key] = value;
      }
    }
    mergedSections._previous_version = previousSnapshot;
    mergedSections._last_update_source = source || "manual";
    mergedSections._last_update_at = new Date().toISOString();

    // Merge CID-10 (dedup)
    const newCid = Array.isArray(parsed.cid10_added) ? parsed.cid10_added : [];
    const existingCid = Array.isArray(laudo.cid10_codes) ? laudo.cid10_codes : [];
    const mergedCid = Array.from(
      new Set([...existingCid, ...newCid].map((c: any) => String(c).trim()).filter(Boolean)),
    );

    // Merge red flags (dedup by lowercase)
    const newFlags = Array.isArray(parsed.red_flags_added) ? parsed.red_flags_added : [];
    const existingFlags = Array.isArray(laudo.red_flags) ? laudo.red_flags : [];
    const seenFlags = new Set<string>();
    const mergedFlags: any[] = [];
    for (const f of [...existingFlags, ...newFlags]) {
      const key = String(typeof f === "string" ? f : f?.text || JSON.stringify(f))
        .toLowerCase()
        .trim();
      if (key && !seenFlags.has(key)) {
        seenFlags.add(key);
        mergedFlags.push(f);
      }
    }

    // Merge complementary exams (dedup)
    const newExams = Array.isArray(parsed.complementary_exams_added)
      ? parsed.complementary_exams_added
      : [];
    const existingExams = Array.isArray(laudo.complementary_exams)
      ? laudo.complementary_exams
      : [];
    const seenExams = new Set<string>();
    const mergedExams: any[] = [];
    for (const e of [...existingExams, ...newExams]) {
      const key = String(typeof e === "string" ? e : JSON.stringify(e)).toLowerCase().trim();
      if (key && !seenExams.has(key)) {
        seenExams.add(key);
        mergedExams.push(e);
      }
    }

    // Update diagnosis_main/diff if hipoteses changed
    const newDiagMain = mergedSections.hipoteses?.principal || laudo.diagnosis_main;
    const newDiagDiff = mergedSections.hipoteses?.diferencial || laudo.diagnosis_diff;

    log(cid, "saving_update", { changed_keys: Object.keys(updatedSections) });
    const { error: updErr } = await supabase
      .from("laudos")
      .update({
        sections: mergedSections,
        cid10_codes: mergedCid,
        red_flags: mergedFlags,
        complementary_exams: mergedExams,
        diagnosis_main: newDiagMain,
        diagnosis_diff: newDiagDiff,
        last_update_type: source === "manual_exam" ? "manual_exam_update" : "editor_complement",
        pdf_version: ((laudo.pdf_version as number) || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", laudo_id);

    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        ok: true,
        change_summary: parsed.change_summary || "Laudo atualizado",
        changed_sections: Object.keys(updatedSections),
        model_used: result.modelUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    log(cid, "error", { msg: e?.message });
    return new Response(
      JSON.stringify({ error: e?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
