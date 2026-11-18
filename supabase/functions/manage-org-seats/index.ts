// Adjusts the seat quantity of the owner's Stripe subscription
// to match the number of active organization members.
// Called server-side after invite acceptance or member removal.
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await userClient.auth.getUser(jwt);
    if (authErr || !userData?.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = userData.user.id;

    const { organization_id, seats } = await req.json();
    if (!organization_id || !Number.isInteger(seats) || seats < 1 || seats > 500) {
      return json({ error: "Dados incompletos" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Caller must be the org owner
    const { data: org } = await admin
      .from("organizations")
      .select("owner_id")
      .eq("id", organization_id)
      .maybeSingle();
    if (!org || org.owner_id !== callerId) {
      return json({ error: "Forbidden" }, 403);
    }
    const owner_id = org.owner_id;

    // Seats can never go below the number of active members.
    const { count: activeCount } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .eq("is_active", true);
    if (seats < (activeCount ?? 1)) {
      return json({ error: "Número de vagas menor que o de membros ativos" }, 400);
    }

    // Reductions are applied here (server-side); increases only take effect
    // when Stripe confirms the new quantity through the webhook.
    const { data: orgSeats } = await admin
      .from("organizations")
      .select("seats_paid")
      .eq("id", organization_id)
      .maybeSingle();
    if (orgSeats && seats < orgSeats.seats_paid) {
      await admin.from("organizations").update({ seats_paid: seats }).eq("id", organization_id);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe não configurado" }, 500);


    // Get owner's stripe subscription
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, plan, status")
      .eq("user_id", owner_id)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) {
      return json({ ok: false, warning: "Owner sem assinatura Stripe ativa — seat reservado mas não cobrado" });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve subscription to find the recurring item
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = subscription.items.data[0];
    if (!item) return json({ error: "Assinatura sem itens" }, 500);

    // Update quantity with proration
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: "create_prorations",
    });

    console.log(`[MANAGE-SEATS] org=${organization_id} owner=${owner_id} seats=${seats} synced to Stripe`);
    return json({ ok: true, seats });
  } catch (e) {
    console.error("manage-org-seats error", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
