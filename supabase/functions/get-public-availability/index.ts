// Public endpoint: validates a booking link token and returns
// available slots for a given doctor/type/date. NO AUTH required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContextResponse {
  link: {
    label: string;
    organization_name: string;
    doctor_id: string | null;
    allowed_appointment_type_ids: string[] | null;
  };
  doctors: Array<{ user_id: string; display_name: string; display_color: string }>;
  appointment_types: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    color: string;
    description: string | null;
  }>;
}

interface SlotsResponse {
  date: string;
  slots: string[]; // ISO strings of start times
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action") ?? "context";

    if (!token || token.length < 8) {
      return json({ error: "Token inválido" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1) Resolve link
    const { data: link, error: linkErr } = await supabase
      .from("booking_links")
      .select(
        "id, label, doctor_id, organization_id, allowed_appointment_type_ids, is_active, expires_at",
      )
      .eq("token", token)
      .maybeSingle();

    if (linkErr || !link || !link.is_active) {
      return json({ error: "Link de agendamento não encontrado ou desativado" }, 404);
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return json({ error: "Este link de agendamento expirou" }, 410);
    }

    if (action === "context") {
      // organization
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", link.organization_id)
        .maybeSingle();

      // doctors: link-specific or all org members
      let doctorsQuery = supabase
        .from("organization_members")
        .select("user_id, display_name, display_color, is_active, role")
        .eq("organization_id", link.organization_id)
        .eq("is_active", true);
      if (link.doctor_id) doctorsQuery = doctorsQuery.eq("user_id", link.doctor_id);
      const { data: members } = await doctorsQuery;
      const doctors = (members ?? [])
        .filter((m) => m.role === "owner" || m.role === "doctor")
        .map((m) => ({
          user_id: m.user_id,
          display_name: m.display_name ?? "Médico",
          display_color: m.display_color ?? "#3b82f6",
        }));

      // appointment types
      let typesQuery = supabase
        .from("appointment_types")
        .select("id, name, duration_minutes, color, description")
        .eq("organization_id", link.organization_id)
        .eq("is_active", true)
        .order("display_order");
      if (link.allowed_appointment_type_ids?.length) {
        typesQuery = typesQuery.in("id", link.allowed_appointment_type_ids);
      }
      const { data: types } = await typesQuery;

      const response: ContextResponse = {
        link: {
          label: link.label,
          organization_name: org?.name ?? "",
          doctor_id: link.doctor_id,
          allowed_appointment_type_ids: link.allowed_appointment_type_ids,
        },
        doctors,
        appointment_types: types ?? [],
      };
      return json(response, 200);
    }

    if (action === "slots") {
      const doctorId = url.searchParams.get("doctor_id");
      const typeId = url.searchParams.get("type_id");
      const dateStr = url.searchParams.get("date"); // YYYY-MM-DD
      if (!doctorId || !typeId || !dateStr) {
        return json({ error: "Parâmetros obrigatórios faltando" }, 400);
      }

      // Validate doctor belongs to org
      const { data: m } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", link.organization_id)
        .eq("user_id", doctorId)
        .eq("is_active", true)
        .maybeSingle();
      if (!m) return json({ error: "Médico inválido" }, 400);

      // Validate type
      const { data: type } = await supabase
        .from("appointment_types")
        .select("id, duration_minutes")
        .eq("organization_id", link.organization_id)
        .eq("id", typeId)
        .eq("is_active", true)
        .maybeSingle();
      if (!type) return json({ error: "Tipo de atendimento inválido" }, 400);

      // Compute weekday and day boundaries (use America/Sao_Paulo offset = -03:00; Brazil no DST)
      const dayStart = new Date(`${dateStr}T00:00:00-03:00`);
      const dayEnd = new Date(`${dateStr}T23:59:59-03:00`);
      const weekday = dayStart.getUTCDay(); // 0..6 in UTC; equivalent because midnight BRT shifts to 03:00 UTC same calendar day

      // Doctor availability for that weekday
      const { data: avs } = await supabase
        .from("doctor_availability")
        .select("start_time, end_time, is_active")
        .eq("organization_id", link.organization_id)
        .eq("doctor_id", doctorId)
        .eq("weekday", weekday)
        .eq("is_active", true);

      if (!avs || avs.length === 0) {
        return json({ date: dateStr, slots: [] } as SlotsResponse, 200);
      }

      // Existing appointments that day
      const { data: appts } = await supabase
        .from("appointments")
        .select("start_at, end_at, status")
        .eq("organization_id", link.organization_id)
        .eq("doctor_id", doctorId)
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString());

      // Unavailability blocks (one-off intersecting the day)
      const { data: blocks } = await supabase
        .from("doctor_unavailability")
        .select("start_at, end_at, recurrence_pattern, recurrence_weekdays, recurrence_end_date")
        .eq("organization_id", link.organization_id)
        .eq("doctor_id", doctorId);

      const busy: Array<[number, number]> = [];
      (appts ?? []).forEach((a) => {
        if (a.status === "cancelled" || a.status === "no_show") return;
        busy.push([new Date(a.start_at).getTime(), new Date(a.end_at).getTime()]);
      });

      const dayStartMs = dayStart.getTime();
      const dayEndMs = dayEnd.getTime();

      (blocks ?? []).forEach((b: any) => {
        const bStart = new Date(b.start_at);
        const bEnd = new Date(b.end_at);
        if (b.recurrence_pattern === "weekly" && Array.isArray(b.recurrence_weekdays)) {
          // Recurring weekly: check if today's weekday is included and not past recurrence_end_date
          if (!b.recurrence_weekdays.includes(weekday)) return;
          if (b.recurrence_end_date && new Date(`${b.recurrence_end_date}T23:59:59-03:00`).getTime() < dayStartMs) return;
          if (bStart.getTime() > dayEndMs) return; // recurrence hasn't started yet
          // Project the block's time-of-day onto the requested date
          const sh = bStart.getUTCHours(), sm = bStart.getUTCMinutes();
          const eh = bEnd.getUTCHours(), em = bEnd.getUTCMinutes();
          // Use BRT-equivalent times derived from the original block
          const projStart = new Date(`${dateStr}T${pad(bStart.getHours())}:${pad(bStart.getMinutes())}:00-03:00`).getTime();
          const projEnd = new Date(`${dateStr}T${pad(bEnd.getHours())}:${pad(bEnd.getMinutes())}:00-03:00`).getTime();
          busy.push([projStart, projEnd]);
        } else {
          // One-off: only include if intersects the day
          if (bEnd.getTime() < dayStartMs || bStart.getTime() > dayEndMs) return;
          busy.push([bStart.getTime(), bEnd.getTime()]);
        }
      });

      const durationMs = type.duration_minutes * 60_000;
      const stepMs = type.duration_minutes * 60_000; // back-to-back slots
      const nowMs = Date.now();
      const slots: string[] = [];

      for (const av of avs) {
        const [sh, sm] = av.start_time.split(":").map(Number);
        const [eh, em] = av.end_time.split(":").map(Number);
        const winStart = new Date(`${dateStr}T${pad(sh)}:${pad(sm)}:00-03:00`).getTime();
        const winEnd = new Date(`${dateStr}T${pad(eh)}:${pad(em)}:00-03:00`).getTime();
        for (let t = winStart; t + durationMs <= winEnd; t += stepMs) {
          if (t < nowMs + 30 * 60_000) continue; // no past / sub-30min slots
          const slotEnd = t + durationMs;
          const overlaps = busy.some(([bs, be]) => t < be && slotEnd > bs);
          if (!overlaps) slots.push(new Date(t).toISOString());
        }
      }

      return json({ date: dateStr, slots } as SlotsResponse, 200);
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("get-public-availability error", e);
    return json({ error: "Erro interno" }, 500);
  }
});

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
