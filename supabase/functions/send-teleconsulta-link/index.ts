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
    const { teleconsulta_id, patient_link, doctor_name, scheduled_at } =
      await req.json();

    if (!teleconsulta_id || !patient_link) {
      return new Response(
        JSON.stringify({ error: "teleconsulta_id e patient_link são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tc } = await supabase
      .from("teleconsultas")
      .select("patient_name, patient_email")
      .eq("id", teleconsulta_id)
      .single();

    if (!tc?.patient_email) {
      return new Response(
        JSON.stringify({ error: "Paciente sem e-mail cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dateLabel = scheduled_at
      ? new Date(scheduled_at).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "full",
          timeStyle: "short",
        })
      : "A confirmar";

    const { error: emailErr } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "teleconsulta-link",
          recipientEmail: tc.patient_email,
          idempotencyKey: `teleconsulta-link-${teleconsulta_id}`,
          templateData: {
            patientName: tc.patient_name,
            doctorName: doctor_name || "MindMed",
            patientLink,
            dateLabel,
          },
        },
      }
    );

    if (emailErr) {
      // Fallback: apenas registra que não conseguiu enviar
      console.error("Send email error:", emailErr);
      return new Response(
        JSON.stringify({ success: false, error: emailErr.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
