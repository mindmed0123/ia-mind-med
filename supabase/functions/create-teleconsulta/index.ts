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
    const { data: claims, error: claimsErr } =
      await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      organization_id,
      patient_name,
      patient_email,
      patient_phone,
      patient_cpf,
      patient_id,
      appointment_id,
      scheduled_at,
      chief_complaint,
    } = body || {};

    if (!organization_id || !patient_name) {
      return new Response(
        JSON.stringify({ error: "organization_id e patient_name são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifica se o usuário é membro da organização
    const { data: isMember } = await supabase.rpc("is_org_member", {
      _org_id: organization_id,
      _user_id: userId,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomName = `mindmed-${crypto.randomUUID().slice(0, 8)}-${Date.now().toString(36)}`;
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");

    let roomUrl = `https://mindmed.daily.co/${roomName}`;
    let dailyRoomId = "";
    let doctorToken = "";
    let patientToken = "";

    if (DAILY_API_KEY) {
      try {
        const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: roomName,
            privacy: "private",
            properties: {
              exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
              max_participants: 2,
              enable_chat: true,
              enable_screenshare: true,
              lang: "pt-BR",
              start_video_off: false,
              start_audio_off: false,
              eject_at_room_exp: true,
              enable_prejoin_ui: true,
            },
          }),
        });
        const dailyRoom = await dailyRes.json();
        if (dailyRoom?.url) {
          roomUrl = dailyRoom.url;
          dailyRoomId = dailyRoom.id ?? "";
        }

        const mkToken = async (isOwner: boolean, userName: string) => {
          const r = await fetch("https://api.daily.co/v1/meeting-tokens", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${DAILY_API_KEY}`,
            },
            body: JSON.stringify({
              properties: {
                room_name: roomName,
                is_owner: isOwner,
                user_name: userName,
                exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
              },
            }),
          });
          const j = await r.json();
          return j?.token ?? "";
        };

        doctorToken = await mkToken(true, "Médico");
        patientToken = await mkToken(false, patient_name);
      } catch (e) {
        console.error("Daily.co error:", e);
      }
    }

    const { data: tc, error } = await supabase
      .from("teleconsultas")
      .insert({
        organization_id,
        doctor_id: userId,
        appointment_id: appointment_id || null,
        patient_id: patient_id || null,
        patient_name,
        patient_email: patient_email || null,
        patient_phone: patient_phone || null,
        patient_cpf: patient_cpf || null,
        room_name: roomName,
        room_url: roomUrl,
        doctor_token: doctorToken || null,
        patient_token: patientToken || null,
        daily_room_id: dailyRoomId || null,
        scheduled_at: scheduled_at || null,
        chief_complaint: chief_complaint || null,
        status: "agendada",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl =
      Deno.env.get("PUBLIC_APP_URL") ||
      req.headers.get("origin") ||
      "https://acesso.mindmed.online";
    const patientLink = `${appUrl}/sala/${tc.id}${patientToken ? `?t=${patientToken}` : ""}`;

    return new Response(JSON.stringify({ teleconsulta: tc, patientLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
