// Public endpoint to create an online appointment via a booking-link token.
// NO AUTH required. Uses service_role and validates everything server-side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookPayload {
  token: string;
  doctor_id: string;
  appointment_type_id: string;
  start_at: string; // ISO
  patient: {
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const body = (await req.json()) as BookPayload;

    if (!body?.token || !body?.doctor_id || !body?.appointment_type_id || !body?.start_at) {
      return json({ error: "Dados incompletos" }, 400);
    }
    const name = body.patient?.name?.trim();
    if (!name || name.length < 2) {
      return json({ error: "Informe o nome completo do paciente" }, 400);
    }
    const phone = body.patient?.phone?.trim() ?? "";
    const email = body.patient?.email?.trim() ?? "";
    if (!phone && !email) {
      return json({ error: "Informe telefone ou e-mail para contato" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1) Resolve token
    const { data: link } = await supabase
      .from("booking_links")
      .select(
        "id, organization_id, doctor_id, allowed_appointment_type_ids, is_active, expires_at, created_by",
      )
      .eq("token", body.token)
      .maybeSingle();

    if (!link || !link.is_active) return json({ error: "Link inválido" }, 404);
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return json({ error: "Link expirado" }, 410);
    }
    if (link.doctor_id && link.doctor_id !== body.doctor_id) {
      return json({ error: "Médico não permitido neste link" }, 400);
    }
    if (
      link.allowed_appointment_type_ids?.length &&
      !link.allowed_appointment_type_ids.includes(body.appointment_type_id)
    ) {
      return json({ error: "Tipo de atendimento não permitido" }, 400);
    }

    // 2) Validate doctor + type belong to org
    const { data: member } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", link.organization_id)
      .eq("user_id", body.doctor_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!member || (member.role !== "owner" && member.role !== "doctor")) {
      return json({ error: "Médico inválido" }, 400);
    }

    const { data: type } = await supabase
      .from("appointment_types")
      .select("id, duration_minutes")
      .eq("organization_id", link.organization_id)
      .eq("id", body.appointment_type_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!type) return json({ error: "Tipo de atendimento inválido" }, 400);

    const startAt = new Date(body.start_at);
    if (isNaN(startAt.getTime())) return json({ error: "Horário inválido" }, 400);
    if (startAt.getTime() < Date.now() + 15 * 60_000) {
      return json({ error: "Escolha um horário futuro" }, 400);
    }
    const endAt = new Date(startAt.getTime() + type.duration_minutes * 60_000);

    // 3) Validate against doctor availability (same weekday, within window)
    const weekday = new Date(startAt.toISOString()).getUTCDay();
    const { data: avs } = await supabase
      .from("doctor_availability")
      .select("start_time, end_time")
      .eq("organization_id", link.organization_id)
      .eq("doctor_id", body.doctor_id)
      .eq("weekday", weekday)
      .eq("is_active", true);

    const dateStr = isoDateBR(startAt);
    const fitsWindow = (avs ?? []).some((a) => {
      const winStart = new Date(`${dateStr}T${a.start_time}-03:00`).getTime();
      const winEnd = new Date(`${dateStr}T${a.end_time}-03:00`).getTime();
      return startAt.getTime() >= winStart && endAt.getTime() <= winEnd;
    });
    if (!fitsWindow) {
      return json({ error: "Este horário está fora da disponibilidade do médico" }, 409);
    }

    // 4) Find/create patient
    let patientId: string | null = null;
    if (email || phone) {
      const orFilter = [
        email ? `email.eq.${email}` : null,
        phone ? `phone.eq.${phone}` : null,
      ].filter(Boolean).join(",");
      const { data: existing } = await supabase
        .from("patients")
        .select("id")
        .eq("organization_id", link.organization_id)
        .or(orFilter)
        .limit(1)
        .maybeSingle();
      if (existing) patientId = existing.id;
    }
    if (!patientId) {
      const { data: created, error: patErr } = await supabase
        .from("patients")
        .insert({
          user_id: link.created_by,
          organization_id: link.organization_id,
          name,
          phone: phone || null,
          email: email || null,
        })
        .select("id")
        .single();
      if (patErr) return json({ error: "Erro ao registrar paciente: " + patErr.message }, 500);
      patientId = created.id;
    }

    // 5) Insert appointment — Postgres EXCLUDE constraint will block conflicts atomically
    const { error: apptErr } = await supabase.from("appointments").insert({
      organization_id: link.organization_id,
      doctor_id: body.doctor_id,
      patient_id: patientId,
      patient_name_snapshot: name,
      patient_phone_snapshot: phone || null,
      patient_email_snapshot: email || null,
      appointment_type_id: body.appointment_type_id,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: "scheduled",
      source: "online",
      notes: body.patient.notes?.trim() || null,
      created_by: link.created_by,
    });

    if (apptErr) {
      // 23P01 = exclusion_violation
      if ((apptErr as { code?: string }).code === "23P01") {
        return json(
          { error: "Este horário acabou de ser ocupado. Escolha outro." },
          409,
        );
      }
      return json({ error: "Não foi possível agendar: " + apptErr.message }, 500);
    }

    return json({ ok: true, scheduled_for: startAt.toISOString() }, 200);
  } catch (e) {
    console.error("book-appointment error", e);
    return json({ error: "Erro interno" }, 500);
  }
});

function isoDateBR(d: Date): string {
  // Convert to BRT (UTC-3) and return YYYY-MM-DD
  const t = new Date(d.getTime() - 3 * 60 * 60_000);
  return t.toISOString().slice(0, 10);
}
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
