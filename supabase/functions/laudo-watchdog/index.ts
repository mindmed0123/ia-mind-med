// Server-side watchdog that recovers laudos stuck in processing states.
// Should be invoked periodically (e.g., via pg_cron every 2 minutes) or manually.
//
// Logic:
// 1. Find laudos with audio_processing_status='processing' or transcript_status='processing'
//    older than STUCK_THRESHOLD_MS (default 8 minutes — generous enough for 90min audio).
// 2. Mark them as 'error' with a clear message so the frontend can show a retry option.
// 3. Returns a JSON summary of recovered laudos.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 8 minutes — long enough for 90min audio chunks (5min each) to finish, 
// short enough to recover quickly if something hangs.
const STUCK_THRESHOLD_MS = 8 * 60 * 1000;
// 12 minutes for laudo generation itself (LLM consolidation can take a while)
const LAUDO_STUCK_THRESHOLD_MS = 12 * 60 * 1000;

function log(step: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: "laudo-watchdog", step, ...data }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const audioCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();
    const laudoCutoff = new Date(
      Date.now() - LAUDO_STUCK_THRESHOLD_MS,
    ).toISOString();

    // Find audio/transcription stuck
    const { data: stuckAudio, error: audioErr } = await sb
      .from("laudos")
      .select("id, user_id, title, audio_processing_status, transcript_status, updated_at")
      .or(
        `audio_processing_status.eq.processing,transcript_status.eq.processing`,
      )
      .lt("updated_at", audioCutoff);

    if (audioErr) {
      log("query_audio_error", { error: audioErr.message });
    }

    // Find generation stuck (status=processing and updated_at older than 12min)
    const { data: stuckLaudo, error: laudoErr } = await sb
      .from("laudos")
      .select("id, user_id, title, status, updated_at")
      .eq("status", "processing")
      .lt("updated_at", laudoCutoff);

    if (laudoErr) {
      log("query_laudo_error", { error: laudoErr.message });
    }

    const recovered: Array<{ id: string; type: string; user_id: string }> = [];

    // Recover audio/transcription
    for (const l of stuckAudio ?? []) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (l.audio_processing_status === "processing") {
        updates.audio_processing_status = "error";
      }
      if (l.transcript_status === "processing") {
        updates.transcript_status = "error";
      }
      const { error } = await sb
        .from("laudos")
        .update(updates)
        .eq("id", l.id);
      if (!error) {
        recovered.push({ id: l.id, type: "audio_or_transcript", user_id: l.user_id });
        log("recovered_audio", {
          laudo_id: l.id,
          user_id: l.user_id,
          stuck_for_min: Math.round(
            (Date.now() - new Date(l.updated_at).getTime()) / 60000,
          ),
        });
      } else {
        log("recover_audio_error", { laudo_id: l.id, error: error.message });
      }
    }

    // Recover laudo generation
    for (const l of stuckLaudo ?? []) {
      const { error } = await sb
        .from("laudos")
        .update({
          status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", l.id);
      if (!error) {
        recovered.push({ id: l.id, type: "laudo_generation", user_id: l.user_id });
        log("recovered_laudo", {
          laudo_id: l.id,
          user_id: l.user_id,
          stuck_for_min: Math.round(
            (Date.now() - new Date(l.updated_at).getTime()) / 60000,
          ),
        });
      } else {
        log("recover_laudo_error", { laudo_id: l.id, error: error.message });
      }
    }

    const summary = {
      ok: true,
      recovered_count: recovered.length,
      recovered,
      duration_ms: Date.now() - t0,
      thresholds: {
        audio_stuck_min: STUCK_THRESHOLD_MS / 60000,
        laudo_stuck_min: LAUDO_STUCK_THRESHOLD_MS / 60000,
      },
    };

    log("done", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("fatal", { msg: err instanceof Error ? err.message : "unknown" });
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
