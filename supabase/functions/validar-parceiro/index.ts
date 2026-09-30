import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { resolverParceiro } from "../_shared/parceiros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { parceiro } = await req.json().catch(() => ({}));
    const p = resolverParceiro(parceiro);
    if (!p) return json({ valido: false });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ valido: false });
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const coupon = await stripe.coupons.retrieve(p.cupom);
    if (!coupon?.valid || !coupon.percent_off) return json({ valido: false });

    return json({ valido: true, percentual: coupon.percent_off, rotulo: p.rotulo });
  } catch (e) {
    console.error("[VALIDAR-PARCEIRO]", e instanceof Error ? e.message : e);
    return json({ valido: false });
  }
});
