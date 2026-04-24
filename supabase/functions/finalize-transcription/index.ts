// Receives the merged transcript (assembled in the browser from N chunks),
// writes it to the laudo, and dispatches generate-laudo. This is the "commit"
// step of the chunked pipeline: parallel chunks → merge in client → one final
// server call to persist + generate.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function log(cid: string, step: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "finalize-transcription", cid, step, ...data }));
}

function asArray(v: unknown) { return Array.isArray(v) ? v : []; }
function asObject(v: unknown) {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cid = crypto.randomUUID();
  let laudoId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    laudoId = body.laudo_id;
    const text: string = body.text || "";
    const segments = asArray(body.segments);
    const duration = Number(body.duration) || 0;
    const mode = body.mode || "complete";
    const language = body.language || "pt";

    if (!laudoId || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "laudo_id e text são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("laudos")
      .select("id, user_id, patient_data, clinical_context, specialty, generation_mode, status")
      .eq("id", laudoId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !existing) {
      return new Response(JSON.stringify({ error: "Laudo não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existing.status === "completed") {
      log(cid, "idempotent_skip", { laudoId });
      return new Response(JSON.stringify({ success: true, idempotent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullTranscript = { text, language, duration, segments };

    const { error: updErr } = await supabase
      .from("laudos")
      .update({
        transcript: fullTranscript,
        transcript_segments: segments,
        transcript_status: "completed",
        audio_processing_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", laudoId)
      .eq("user_id", user.id);

    if (updErr) {
      throw new Error("Erro ao salvar transcrição: " + updErr.message);
    }

    log(cid, "transcript_saved", { laudoId, len: text.length, segments: segments.length });

    // Build generate-laudo payload from existing laudo metadata
    const patientData = asObject(existing.patient_data);
    const clinicalContext = asObject(existing.clinical_context);
    const generationMode = (existing.generation_mode as string) || mode;

    const generatePayload = {
      patient: {
        iniciais: typeof patientData.iniciais === "string" ? patientData.iniciais : "N/I",
        sexo: typeof patientData.sexo === "string" ? patientData.sexo : "Não informado",
        idade: Number(patientData.idade) || 0,
      },
      specialty:
        (typeof clinicalContext.specialty === "string" && clinicalContext.specialty) ||
        (typeof patientData.especialidade === "string" && patientData.especialidade) ||
        (typeof existing.specialty === "string" && existing.specialty) ||
        "Não especificada",
      chief_complaint:
        (typeof patientData.queixa_principal === "string" && patientData.queixa_principal) ||
        (typeof clinicalContext.chief_complaint === "string" && clinicalContext.chief_complaint) ||
        "Não informada",
      transcript: text,
      vitals: { ...asObject(clinicalContext.vitals), ...asObject(patientData.sinais_vitais) },
      meds: asArray(patientData.medicacoes).length ? asArray(patientData.medicacoes) : asArray(clinicalContext.meds),
      allergies: asArray(patientData.alergias).length ? asArray(patientData.alergias) : asArray(clinicalContext.allergies),
      exam_findings: typeof clinicalContext.exam_findings === "string" ? clinicalContext.exam_findings : "",
      contexto_clinico:
        (typeof patientData.contexto_clinico === "string" && patientData.contexto_clinico) ||
        (typeof clinicalContext.contexto_clinico === "string" && clinicalContext.contexto_clinico) ||
        "",
      historico:
        (typeof patientData.historico === "string" && patientData.historico) ||
        (typeof clinicalContext.historico === "string" && clinicalContext.historico) ||
        "",
      laudo_id: laudoId,
      mode: generationMode,
      template_specialty: typeof existing.specialty === "string" ? existing.specialty : undefined,
    };

    // Dispatch generate-laudo asynchronously (don't await — UI is polling)
    const dispatchPromise = fetch(`${supabaseUrl}/functions/v1/generate-laudo`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(generatePayload),
    })
      .then(async (r) => {
        const body = await r.text();
        log(cid, "generate_dispatched", { status: r.status, body_preview: body.slice(0, 180) });
      })
      .catch((e) => log(cid, "generate_dispatch_error", { msg: e instanceof Error ? e.message : "unknown" }));

    const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
    if (waitUntil) waitUntil(dispatchPromise);

    return new Response(
      JSON.stringify({ success: true, transcript: fullTranscript, generation_dispatched: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log(cid, "error", { laudoId, msg: err instanceof Error ? err.message : "unknown" });
    // Mark as error so UI can recover
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const adminSupabase = createClient(supabaseUrl, supabaseKey);
      if (laudoId) {
        await adminSupabase
          .from("laudos")
          .update({ transcript_status: "error", audio_processing_status: "error" })
          .eq("id", laudoId);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: "Erro ao finalizar transcrição", error_id: cid }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
