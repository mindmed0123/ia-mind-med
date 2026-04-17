// Accepts an organization invite. Caller must be authenticated.
// Increments seats_paid on the organization (Stripe sync handled separately).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);

    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "Token inválido" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });

    // Use the SECURITY DEFINER function — runs as the authenticated user
    const { data, error } = await userClient.rpc("accept_organization_invite", {
      _token: token,
    });

    if (error) return json({ error: error.message }, 500);
    const result = data as { ok: boolean; error?: string; organization_id?: string };
    if (!result.ok) {
      return json({ error: result.error || "Não foi possível aceitar o convite" }, 400);
    }

    // Increment seats_paid (best effort) — actual Stripe sync happens in manage-org-seats
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    try {
      const { data: org } = await admin
        .from("organizations")
        .select("seats_paid, owner_id")
        .eq("id", result.organization_id!)
        .maybeSingle();
      if (org) {
        const { count: activeCount } = await admin
          .from("organization_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", result.organization_id!)
          .eq("is_active", true);
        const needed = Math.max(activeCount ?? 1, org.seats_paid);
        if (needed > org.seats_paid) {
          await admin
            .from("organizations")
            .update({ seats_paid: needed })
            .eq("id", result.organization_id!);
          // Trigger Stripe seat update for the owner
          admin.functions.invoke("manage-org-seats", {
            body: { organization_id: result.organization_id, owner_id: org.owner_id, seats: needed },
          }).catch((e) => console.error("Seat sync failed:", e));
        }
      }
    } catch (e) {
      console.error("Seat update non-blocking error:", e);
    }

    return json({ ok: true, organization_id: result.organization_id });
  } catch (e) {
    console.error("accept-org-invite error", e);
    return json({ error: "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
