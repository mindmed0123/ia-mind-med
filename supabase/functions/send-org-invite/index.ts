// Sends an organization invite email and creates the invite record.
// Caller must be authenticated as the org owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  organization_id: string;
  email: string;
  full_name?: string;
  display_color?: string;
  role?: "doctor" | "staff";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth check using anon + bearer
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "Não autenticado" }, 401);
    const userId = u.user.id;

    const body = (await req.json()) as Payload;
    if (!body.organization_id || !body.email) {
      return json({ error: "Dados incompletos" }, 400);
    }
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "E-mail inválido" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Verify caller is owner
    const { data: org } = await admin
      .from("organizations")
      .select("id, name, owner_id, seats_paid")
      .eq("id", body.organization_id)
      .maybeSingle();
    if (!org || org.owner_id !== userId) {
      return json({ error: "Apenas o dono da organização pode convidar" }, 403);
    }

    // Check pending invite for same email
    const { data: existing } = await admin
      .from("organization_invites")
      .select("id, status")
      .eq("organization_id", body.organization_id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return json({ error: "Já existe um convite pendente para este e-mail" }, 409);
    }

    // Generate token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const { data: invite, error: insErr } = await admin
      .from("organization_invites")
      .insert({
        organization_id: body.organization_id,
        invited_by: userId,
        email,
        full_name: body.full_name?.trim() || null,
        display_color: body.display_color || "#3b82f6",
        role: body.role || "doctor",
        token,
      })
      .select("*")
      .single();
    if (insErr) return json({ error: "Erro ao criar convite: " + insErr.message }, 500);

    // Get inviter name
    const { data: inviter } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    // Send email via existing transactional infrastructure
    const inviteUrl = `${req.headers.get("origin") || "https://acesso.mindmed.online"}/aceitar-convite?token=${token}`;

    try {
      await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "org-invite",
          recipientEmail: email,
          idempotencyKey: `org-invite-${invite.id}`,
          templateData: {
            organizationName: org.name,
            inviterName: inviter?.full_name || "O administrador",
            inviteUrl,
            recipientName: body.full_name || email,
          },
        },
      });
    } catch (e) {
      console.error("Email send failed (non-blocking):", e);
    }

    return json({ ok: true, invite_id: invite.id, invite_url: inviteUrl });
  } catch (e) {
    console.error("send-org-invite error", e);
    return json({ error: "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
