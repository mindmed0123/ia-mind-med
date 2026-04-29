// Stateless single-chunk transcription. Takes one audio chunk (multipart),
// returns text + segments + offset metadata. The caller (browser) is
// responsible for ordering and merging chunk results, then writing the final
// transcript to the laudo and dispatching generate-laudo.
//
// This keeps the HTTP timeout per call low (~15-30s for a 5min chunk) and lets
// the client run multiple chunks in parallel.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  CLINICAL_WHISPER_PROMPT_PT_BR,
  processWhisperSegments,
  transcriptFromSegments,
} from "../_shared/clinical-transcription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function log(cid: string, step: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "transcribe-chunk", cid, step, ...data }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const form = await req.formData();
    const file = form.get("file");
    const chunkIndexStr = form.get("chunk_index");
    const startSecStr = form.get("start_sec");
    const laudoId = form.get("laudo_id");

    if (!(file instanceof File) || !chunkIndexStr || !startSecStr || !laudoId) {
      return new Response(
        JSON.stringify({ error: "file, chunk_index, start_sec e laudo_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const chunkIndex = Number(chunkIndexStr);
    const startSec = Number(startSecStr);

    // Verify the laudo belongs to the user (cheap auth check, prevents abuse)
    const { data: laudo, error: laudoErr } = await supabase
      .from("laudos")
      .select("id, user_id")
      .eq("id", laudoId as string)
      .eq("user_id", user.id)
      .single();

    if (laudoErr || !laudo) {
      return new Response(JSON.stringify({ error: "Laudo não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key não configurada");
    }

    log(cid, "chunk_received", { chunkIndex, size: file.size, startSec });

    const whisperForm = new FormData();
    whisperForm.append("file", file, `chunk-${chunkIndex}.wav`);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "pt");
    whisperForm.append("response_format", "verbose_json");
    whisperForm.append("timestamp_granularities[]", "segment");
    // Deterministic output → same audio always produces same text (critical
    // for medical record reproducibility). 0 = greedy decoding.
    whisperForm.append("temperature", "0");
    // Clinical priming — biases Whisper toward correct medical PT-BR spelling
    // (medications, anatomy, CIDs, vitals, abbreviations).
    whisperForm.append("prompt", CLINICAL_WHISPER_PROMPT_PT_BR);

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort("timeout"), 90000);
    const t0 = Date.now();
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: whisperForm,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const latencyMs = Date.now() - t0;

    if (!response.ok) {
      const errText = await response.text();
      log(cid, "whisper_error", { status: response.status, body: errText.slice(0, 200) });
      let clientStatus = response.status;
      let message = "Erro na transcrição do chunk";
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.code === "insufficient_quota") {
          clientStatus = 402;
          message = "Créditos insuficientes na API de transcrição.";
        } else if (parsed?.error?.message) {
          message = parsed.error.message;
        }
      } catch (_) { /* ignore */ }

      return new Response(JSON.stringify({ error: message, chunk_index: chunkIndex }), {
        status: clientStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    // Filter Whisper hallucinations + apply clinical text normalization
    // (acronyms, units, BP format). Build the chunk text from the *cleaned*
    // segments so the merged transcript is consistent.
    const segments = processWhisperSegments(data.segments || [], startSec);
    const text = transcriptFromSegments(
      segments.map((s) => ({ ...s, start: s.start - startSec, end: s.end - startSec })),
    );
    const droppedCount = (data.segments?.length || 0) - segments.length;

    log(cid, "chunk_done", {
      chunkIndex,
      latencyMs,
      segments: segments.length,
      dropped_hallucinations: droppedCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        chunk_index: chunkIndex,
        start_sec: startSec,
        text,
        segments,
        duration: data.duration || 0,
        latency_ms: latencyMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log(cid, "error", { message: err instanceof Error ? err.message : "unknown" });
    return new Response(
      JSON.stringify({ error: "Erro ao processar chunk", error_id: cid }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
