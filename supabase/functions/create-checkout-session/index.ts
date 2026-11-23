import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolverParceiro, PLANOS_COM_CUPOM } from "../_shared/parceiros.ts";
import { safeAppOrigin } from "../_shared/allowed-origin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MindMed price IDs (via secrets — nunca hardcoded)
const PRICES: Record<string, string | undefined> = {
  mindmed_starter:   Deno.env.get("STRIPE_PRICE_STARTER_MONTHLY"),
  mindmed_pro:       Deno.env.get("STRIPE_PRICE_PRO_MONTHLY"),
  mindmed_pro_anual: Deno.env.get("STRIPE_PRICE_PRO_ANNUAL"),
  mindmed_fundador:  Deno.env.get("STRIPE_PRICE_FUNDADOR"),
};

const PLAN_TO_DB: Record<string, string> = {
  mindmed_starter:   "STARTER",
  mindmed_pro:       "PRO",
  mindmed_pro_anual: "PRO",
  mindmed_fundador:  "PRO",
};

const PLANOS_ANUAIS = ["mindmed_pro_anual", "mindmed_fundador"];

const ATTR_KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","gclid","mm_lp","landing_path","referrer","fbc","fbp"];

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
    const { name, whatsapp, plan = "mindmed_pro", attribution = {}, parceiro } = body;

    // Parceiro: token inválido/ausente é ignorado em silêncio
    const p = resolverParceiro(parceiro);
    const discounts = p && PLANOS_COM_CUPOM.includes(plan) ? [{ coupon: p.cupom }] : undefined;
    const parceiroMeta: Record<string, string> = discounts && p ? { parceiro: p.slug } : {};

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

    // Fundador: corte automático quando as vagas acabam
    if (plan === "mindmed_fundador") {
      const { data: subAtual } = await supabase
        .from("subscriptions")
        .select("plan_origem")
        .eq("user_id", userId)
        .maybeSingle();

      const jaEraFundador = subAtual?.plan_origem === "mindmed_fundador";

      if (!jaEraFundador) {
        const { data: vagas } = await supabase.rpc("fundador_vagas");
        const totais = Number((vagas as any)?.totais ?? 100);
        const ocupadas = Number((vagas as any)?.ocupadas ?? 0);
        if (totais - ocupadas <= 0) {
          return new Response(
            JSON.stringify({ error: `As ${totais} vagas de fundador foram preenchidas.` }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fundador nunca tem trial: a garantia de 30 dias cobre o risco.
    // Nos demais planos, só concede trial para quem nunca teve um.
    let trialDays: number | undefined = undefined;

    if (plan !== "mindmed_fundador") {
      const { data: subAtual } = await supabase
        .from("subscriptions")
        .select("trial_start")
        .eq("user_id", userId)
        .maybeSingle();

      const jaTeveTrial = !!subAtual?.trial_start;
      if (!jaTeveTrial) trialDays = 7;
    }
    logStep("Trial policy", { plan, trialDays: trialDays ?? 0 });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse only a Stripe customer that provably belongs to this account: the id
    // stored for this user, or an e-mail match tagged with this user's id. An
    // untagged e-mail match may belong to someone else (e-mails are unconfirmed).
    const { data: subCustomer } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerId: string | null = (subCustomer?.stripe_customer_id as string | undefined) ?? null;
    if (customerId) {
      const stored = await stripe.customers.retrieve(customerId).catch(() => null);
      if (!stored || (stored as Stripe.DeletedCustomer).deleted) customerId = null;
    }
    if (!customerId) {
      const customers = await stripe.customers.list({ email, limit: 10 });
      const owned = customers.data.find((c: Stripe.Customer) => !c.deleted && c.metadata?.user_id === userId);
      customerId = owned?.id ?? null;
    }

    if (customerId) {
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
    const origin = safeAppOrigin(req);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      locale: "pt-BR",
      payment_method_types: ["card"],
      payment_method_collection: "always",
      billing_address_collection: "auto",
      allow_promotion_codes: false,
      ...(discounts ? { discounts } : {}),

      // Atribuição: permite ver no painel do Stripe de qual campanha veio cada assinatura
      client_reference_id: userId,

      line_items: [{ price: priceId, quantity: 1 }],

      subscription_data: {
        ...(trialDays ? {
          trial_period_days: trialDays,
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" as const },
          },
        } : {}),
        metadata: {
          user_id: userId,
          plan: plan,
          ...attr,
          ...parceiroMeta,
        },
      },

      metadata: {
        user_id: userId,
        plan: plan,
        ...attr,
        ...parceiroMeta,
      },

      custom_text: {
        submit: {
          message: trialDays
            ? "Seus 7 dias de teste começam agora e nada é cobrado neste momento. " +
              "Se você cancelar antes do fim do teste, não há cobrança. " +
              "E se depois da primeira cobrança você não estiver satisfeito, devolvemos 100% do valor em até 30 dias."
            : "A cobrança acontece agora. Garantia de 30 dias: se não estiver satisfeito, devolvemos 100% do valor, sem formulário e sem pergunta.",
        },
      },


      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/medicos/teste-gratis?checkout=canceled`,
    });

    logStep("Created checkout session", { sessionId: session.id, url: session.url });

    // Vínculo com o parceiro: só quando o cupom foi aplicado e só se a conta ainda não tem vínculo.
    if (discounts && p) {
      const { error: parceiroError } = await supabase
        .from("profiles")
        .update({ parceiro_slug: p.slug })
        .eq("id", userId)
        .is("parceiro_slug", null);
      if (parceiroError) logStep("Error saving parceiro_slug", { error: parceiroError });
    }

    // Update user's subscription status to pending_checkout
    const now = new Date();
    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        status: "PENDING_CHECKOUT",
        plan: PLAN_TO_DB[plan] ?? "PRO",
        plan_origem: plan,
        billing_cycle: PLANOS_ANUAIS.includes(plan) ? "ANNUAL" : "MONTHLY",
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
