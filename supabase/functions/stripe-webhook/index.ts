import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const body = await req.text();
    const event = JSON.parse(body) as Stripe.Event;
    
    logStep("Event type", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const plan = session.metadata?.plan || "mindmed_pro";

        logStep("Checkout completed", { userId, subscriptionId, customerId, plan });

        if (userId) {
          const now = new Date();
          const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          const { error } = await supabase
            .from("subscriptions")
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: "TRIALING",
              plan: plan === "mindmed_starter" ? "STARTER" : "PRO",
              trial_start: now.toISOString(),
              trial_end: trialEnd.toISOString(),
              current_period_start: now.toISOString(),
              current_period_end: trialEnd.toISOString(),
              payment_provider: "stripe",
              remaining_starter_credits: plan === "mindmed_starter" ? 10 : null,
              quota_used: 0,
            }, {
              onConflict: "user_id",
              ignoreDuplicates: false,
            });

          if (error) {
            logStep("Error updating subscription", { error });
          } else {
            logStep("Subscription updated to TRIALING");
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        logStep("Invoice paid", { subscriptionId });

        if (subscriptionId) {
          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = subscription.customer as string;

          // Find user by stripe_subscription_id or stripe_customer_id
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("user_id")
            .or(`stripe_subscription_id.eq.${subscriptionId},stripe_customer_id.eq.${customerId}`)
            .limit(1)
            .single();

          if (subData?.user_id) {
            const { error } = await supabase
              .from("subscriptions")
              .update({
                status: "ACTIVE",
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              })
              .eq("user_id", subData.user_id);

            if (error) {
              logStep("Error updating to ACTIVE", { error });
            } else {
              logStep("Subscription updated to ACTIVE");
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        logStep("Invoice payment failed", { subscriptionId });

        if (subscriptionId) {
          const { error } = await supabase
            .from("subscriptions")
            .update({ status: "INACTIVE" })
            .eq("stripe_subscription_id", subscriptionId);

          if (error) {
            logStep("Error updating to INACTIVE", { error });
          } else {
            logStep("Subscription updated to INACTIVE");
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        logStep("Subscription deleted", { subscriptionId });

        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "CANCELED" })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          logStep("Error updating to CANCELED", { error });
        } else {
          logStep("Subscription updated to CANCELED");
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const stripeStatus = subscription.status;

        logStep("Subscription updated", { subscriptionId, stripeStatus });

        let dbStatus: string;
        switch (stripeStatus) {
          case "active":
            dbStatus = "ACTIVE";
            break;
          case "trialing":
            dbStatus = "TRIALING";
            break;
          case "past_due":
          case "incomplete":
          case "incomplete_expired":
          case "unpaid":
            dbStatus = "INACTIVE";
            break;
          case "canceled":
            dbStatus = "CANCELED";
            break;
          default:
            dbStatus = "INACTIVE";
        }

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: dbStatus,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          logStep("Error updating subscription status", { error });
        } else {
          logStep(`Subscription updated to ${dbStatus}`);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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
