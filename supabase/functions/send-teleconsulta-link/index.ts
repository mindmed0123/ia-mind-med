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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(jwt);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const callerId = claims.claims.sub as string;

    const { teleconsulta_id, doctor_name, scheduled_at } = await req.json();

    if (!teleconsulta_id) {
      return new Response(
        JSON.stringify({ error: "teleconsulta_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tc } = await supabase
      .from("teleconsultas")
      .select("id, patient_name, patient_email, patient_token, doctor_id")
      .eq("id", teleconsulta_id)
      .single();

    if (!tc || tc.doctor_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!tc.patient_email) {
      return new Response(
        JSON.stringify({ error: "Paciente sem e-mail cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the patient link server-side (do not trust client)
    const appBase = Deno.env.get("APP_BASE_URL") ?? "https://acesso.mindmed.online";
    const patientLink = `${appBase}/sala-paciente/${tc.id}?t=${encodeURIComponent(tc.patient_token ?? "")}`;


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
