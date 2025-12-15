import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MindMed price IDs
const PRICES = {
  mindmed_starter: "price_1SedBNRpmClnFRZodLtgM25d", // R$ 99,90/mês
  mindmed_pro: "price_1SCj9YRpmClnFRZoaPfNUPRH",     // R$ 299,00/mês
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const body = await req.json();
    const { userId, email, name, whatsapp, plan = "mindmed_pro" } = body;
    
    logStep("Received request", { userId, email, plan });

    if (!userId || !email) {
      throw new Error("userId and email are required");
    }

    const priceId = PRICES[plan as keyof typeof PRICES];
    if (!priceId) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email,
        name,
        phone: whatsapp,
        metadata: { user_id: userId }
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    // Create checkout session with 7-day trial
    const origin = req.headers.get("origin") || "https://acesso.mindmed.online";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          user_id: userId,
          plan: plan,
        },
      },
      metadata: {
        user_id: userId,
        plan: plan,
      },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/medicos/teste-gratis?checkout=canceled`,
      allow_promotion_codes: true,
    });

    logStep("Created checkout session", { sessionId: session.id, url: session.url });

    // Update user's subscription status to pending_checkout
    const now = new Date();
    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        status: "PENDING_CHECKOUT",
        plan: plan === "mindmed_starter" ? "STARTER" : "PRO",
        stripe_customer_id: customerId,
        current_period_start: now.toISOString(),
        current_period_end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        payment_provider: "stripe",
      }, {
        onConflict: "user_id",
        ignoreDuplicates: false,
      });

    if (subError) {
      logStep("Error updating subscription", { error: subError });
      // Don't throw - continue with checkout
    }

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
