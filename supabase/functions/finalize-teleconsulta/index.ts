// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { teleconsulta_id, notes, diagnosis_summary, generate_laudo } =
      await req.json();

    const { data: tc } = await supabase
      .from("teleconsultas")
      .select("*")
      .eq("id", teleconsulta_id)
      .single();

    if (!tc) {
      return new Response(JSON.stringify({ error: "Teleconsulta não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (tc.doctor_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endedAt = new Date();
    const startedAt = tc.started_at
      ? new Date(tc.started_at)
      : tc.room_opened_at
        ? new Date(tc.room_opened_at)
        : null;
    const durationSeconds = startedAt
      ? Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
      : null;

    await supabase
      .from("teleconsultas")
      .update({
        status: "concluida",
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        notes_during_call: notes ?? tc.notes_during_call,
        diagnosis_summary: diagnosis_summary ?? null,
      })
      .eq("id", teleconsulta_id);

    let laudoId: string | null = null;
    if (generate_laudo && (notes || tc.notes_during_call)) {
      try {
        const sourceText = `TELECONSULTA — ${tc.patient_name}\n\nQueixa principal: ${tc.chief_complaint || "Não informada"}\n\nNotas da consulta:\n${notes || tc.notes_during_call}`;

        const { data: laudo } = await supabase
          .from("laudos")
          .insert({
            user_id: tc.doctor_id,
            title: `Teleconsulta — ${tc.patient_name}`,
            patient_id: tc.patient_id,
            patient_data: {
              name: tc.patient_name,
              cpf: tc.patient_cpf,
              email: tc.patient_email,
              phone: tc.patient_phone,
            },
            transcript: { text: sourceText },
            transcript_status: "completed",
            status: "draft",
          })
          .select()
          .single();

        if (laudo) {
          laudoId = laudo.id;
          await supabase
            .from("teleconsultas")
            .update({ laudo_id: laudoId })
            .eq("id", teleconsulta_id);

          // Dispara geração de IA do laudo (não bloqueante)
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/generate-laudo`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: SUPABASE_SERVICE_ROLE_KEY,
              },
              body: JSON.stringify({ laudo_id: laudoId }),
            });
          } catch (genErr) {
            console.error("generate-laudo dispatch error:", genErr);
          }
        }
      } catch (e) {
        console.error("Laudo creation error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        duration_seconds: durationSeconds,
        laudo_id: laudoId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
