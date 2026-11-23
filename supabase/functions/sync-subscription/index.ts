// Pulls the caller's subscription straight from Stripe and mirrors it onto
// public.subscriptions. Called after checkout and on app load so access never
// depends only on webhook delivery.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  applyStripeSubscription,
  knownPriceIds,
  pickSubscription,
} from "../_shared/stripe-subscription-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const log = (step: string, data?: Record<string, unknown>) =>
  console.log(`[SYNC-SUBSCRIPTION] ${step}${data ? ` - ${JSON.stringify(data)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.slice(7));
    const userId = claims?.claims?.sub as string | undefined;
    const email = claims?.claims?.email as string | undefined;
    if (authErr || !userId) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: row } = await supabase
      .from("subscriptions")
      .select("status, plan_origem, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (row?.plan_origem === "courtesy_admin") return json({ synced: false, status: row.status });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Customer ids: the one stored at checkout, plus e-mail matches tagged with
    // this user (create-checkout-session tags new customers with user_id).
    const customerIds = new Set<string>();
    if (row?.stripe_customer_id) customerIds.add(row.stripe_customer_id);
    if (email) {
      const found = await stripe.customers.list({ email, limit: 10 });
      for (const c of found.data) {
        if (c.metadata?.user_id === userId || c.id === row?.stripe_customer_id) customerIds.add(c.id);
      }
    }
    if (customerIds.size === 0) return json({ synced: false, status: row?.status ?? null });

    const prices = knownPriceIds();
    const candidates: Stripe.Subscription[] = [];
    for (const customer of customerIds) {
      const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 10 });
      for (const s of subs.data) {
        const priceId = s.items?.data?.[0]?.price?.id;
        const ownsByMeta = s.metadata?.user_id === userId;
        if ((ownsByMeta || (priceId && prices.has(priceId))) && (!s.metadata?.user_id || ownsByMeta)) {
          candidates.push(s);
        }
      }
    }

    const sub = pickSubscription(candidates);
    if (!sub) return json({ synced: false, status: row?.status ?? null });

    // An ended Stripe subscription only overrides the row it created; it never
    // revokes access granted outside Stripe (e.g. a VIP trial).
    const live = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
    if (!live && row?.stripe_subscription_id !== sub.id) {
      return json({ synced: false, status: row?.status ?? null });
    }

    const result = await applyStripeSubscription(supabase, sub, userId);
    log("synced", { userId: userId.slice(0, 8), sub: sub.id, stripeStatus: sub.status, status: result.status });
    return json({ synced: result.updated, status: result.status, trial: sub.status === "trialing" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return json({ error: "Não foi possível confirmar a assinatura agora." }, 500);
  }
});
