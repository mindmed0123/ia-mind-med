import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MindMed price IDs (via secrets — nunca hardcoded)
const PRICES: Record<string, string | undefined> = {
  mindmed_starter:   Deno.env.get("STRIPE_PRICE_STARTER_MONTHLY"),
  mindmed_pro:       Deno.env.get("STRIPE_PRICE_PRO_MONTHLY"),
  mindmed_pro_anual: Deno.env.get("STRIPE_PRICE_PRO_ANNUAL"),
};

const PLAN_TO_DB: Record<string, string> = {
  mindmed_starter:   "STARTER",
  mindmed_pro:       "PRO",
  mindmed_pro_anual: "PRO",
};

const ATTR_KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","gclid","mm_lp","landing_path","referrer"];

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Require authenticated caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(jwt);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const authedUserId = claims.claims.sub as string;
    const authedEmail = (claims.claims.email as string | undefined) ?? null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const body = await req.json();
    const { name, whatsapp, plan = "mindmed_pro", attribution = {} } = body;

    // Sanitiza atribuição: só strings conhecidas, máximo 200 caracteres cada
    const attr: Record<string, string> = {};
    for (const k of ATTR_KEYS) {
      const v = attribution?.[k];
      if (typeof v === "string" && v.length > 0) attr[k] = v.slice(0, 200);
    }

    // Never trust client-supplied user identity
    const userId = authedUserId;
    const email = authedEmail ?? body.email;

    logStep("Received request", { userId, email, plan, attr });

    if (!userId || !email) {
      throw new Error("Authenticated user has no email");
    }

    if (!(plan in PRICES)) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const priceId = PRICES[plan];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Price ID não configurado para o plano: ${plan}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      locale: "pt-BR",
      payment_method_types: ["card"],
      payment_method_collection: "always",
      billing_address_collection: "auto",
      allow_promotion_codes: true,

      // Atribuição: permite ver no painel do Stripe de qual campanha veio cada assinatura
      client_reference_id: userId,

      line_items: [{ price: priceId, quantity: 1 }],

      subscription_data: {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: {
          user_id: userId,
          plan: plan,
          ...attr,
        },
      },

      metadata: {
        user_id: userId,
        plan: plan,
        ...attr,
      },

      custom_text: {
        submit: {
          message:
            "Seus 7 dias de teste começam agora e nada é cobrado neste momento. " +
            "Se você cancelar antes do fim do teste, não há cobrança. " +
            "E se depois da primeira cobrança você não estiver satisfeito, devolvemos 100% do valor em até 30 dias.",
        },
      },

      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/medicos/teste-gratis?checkout=canceled`,
    });

    logStep("Created checkout session", { sessionId: session.id, url: session.url });

    // Update user's subscription status to pending_checkout
    const now = new Date();
    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        status: "PENDING_CHECKOUT",
        plan: PLAN_TO_DB[plan] ?? "PRO",
        billing_cycle: plan === "mindmed_pro_anual" ? "ANNUAL" : "MONTHLY",
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
