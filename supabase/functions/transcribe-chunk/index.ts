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
import { transcribeClinicalAudio, TranscriptionError } from "../_shared/gateway-transcribe.ts";

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

    log(cid, "chunk_received", { chunkIndex, size: file.size, startSec });

    const t0 = Date.now();
    let result;
    try {
      result = await transcribeClinicalAudio(file, startSec);
    } catch (txError) {
      if (!(txError instanceof TranscriptionError)) throw txError;
      log(cid, "transcription_error", { chunkIndex, status: txError.status, code: txError.code });
      return new Response(JSON.stringify({ error: txError.message, code: txError.code, chunk_index: chunkIndex }), {
        status: txError.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const latencyMs = Date.now() - t0;
    const { text, segments } = result;

    log(cid, "chunk_done", { chunkIndex, latencyMs, chars: text.length });

    return new Response(
      JSON.stringify({
        success: true,
        chunk_index: chunkIndex,
        start_sec: startSec,
        text,
        segments,
        duration: result.durationSec || 0,
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
