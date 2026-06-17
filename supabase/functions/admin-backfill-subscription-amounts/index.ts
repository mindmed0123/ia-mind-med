// One-shot backfill of subscriptions.amount_cents / currency / billing_interval
// from Stripe for existing subscriptions. Admin/super_admin/finance only.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[BACKFILL] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.rpc("is_billing_admin", { _user_id: userId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: subs, error: subsErr } = await admin
      .from("subscriptions")
      .select("id, stripe_subscription_id, amount_cents")
      .not("stripe_subscription_id", "is", null);
    if (subsErr) throw subsErr;

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const s of subs ?? []) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(s.stripe_subscription_id as string);
        const item = stripeSub.items?.data?.[0];
        const price = item?.price;
        if (!price?.unit_amount || !price?.recurring?.interval) {
          skipped++;
          continue;
        }
        const { error: upErr } = await admin
          .from("subscriptions")
          .update({
            amount_cents: price.unit_amount,
            currency: price.currency,
            billing_interval: price.recurring.interval,
          })
          .eq("id", s.id);
        if (upErr) throw upErr;
        updated++;
      } catch (e) {
        failed++;
        errors.push({ id: s.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    log("done", { updated, skipped, failed });
    return new Response(
      JSON.stringify({ ok: true, total: subs?.length ?? 0, updated, skipped, failed, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
