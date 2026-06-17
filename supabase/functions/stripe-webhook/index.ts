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

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errMsg });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
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

          // Fetch price details from Stripe so MRR is accurate
          let amount_cents: number | null = null;
          let currency: string | null = null;
          let billing_interval: string | null = null;
          try {
            if (subscriptionId) {
              const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
              const price = stripeSub.items?.data?.[0]?.price;
              if (price?.unit_amount) {
                amount_cents = price.unit_amount;
                currency = price.currency;
                billing_interval = price.recurring?.interval ?? "month";
              }
            }
          } catch (e) {
            logStep("Failed to load price from Stripe", { error: e instanceof Error ? e.message : String(e) });
          }

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
              ...(amount_cents != null ? { amount_cents, currency, billing_interval } : {}),
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
            const price = subscription.items?.data?.[0]?.price;
            const updatePayload: Record<string, unknown> = {
              status: "ACTIVE",
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            };
            if (price?.unit_amount) {
              updatePayload.amount_cents = price.unit_amount;
              updatePayload.currency = price.currency;
              updatePayload.billing_interval = price.recurring?.interval ?? "month";
            }
            const { error } = await supabase
              .from("subscriptions")
              .update(updatePayload)
              .eq("user_id", subData.user_id);

            if (error) {
              logStep("Error updating to ACTIVE", { error });
            } else {
              logStep("Subscription updated to ACTIVE");

              // Send upgrade confirmed email
              const { data: profile } = await supabase
                .from("profiles")
                .select("email, full_name")
                .eq("id", subData.user_id)
                .maybeSingle();

              if (profile?.email) {
                const planItems = subscription.items?.data || [];
                const planName = planItems[0]?.price?.lookup_key?.includes('starter') ? 'Starter' : 'Pro';

                await supabase.functions.invoke('send-transactional-email', {
                  body: {
                    templateName: 'upgrade-confirmed',
                    recipientEmail: profile.email,
                    idempotencyKey: `upgrade-${subData.user_id}-${subscriptionId}`,
                    templateData: {
                      doctorName: profile.full_name,
                      planName,
                    },
                  },
                }).catch((err: any) => logStep("Upgrade email failed", { error: err }));
              }
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;

        logStep("Invoice payment failed", { subscriptionId, customerId });

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

        // Send payment-failed transactional email with Stripe billing portal URL
        if (customerId) {
          try {
            const { data: subRow } = await supabase
              .from("subscriptions")
              .select("user_id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();

            if (subRow?.user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("email, full_name")
                .eq("id", subRow.user_id)
                .maybeSingle();

              if (profile?.email) {
                let portalUrl = "https://acesso.mindmed.online";
                try {
                  const portalSession = await stripe.billingPortal.sessions.create({
                    customer: customerId,
                    return_url: "https://acesso.mindmed.online",
                  });
                  portalUrl = portalSession.url;
                } catch (portalErr) {
                  logStep("Failed to create billing portal session", { error: portalErr });
                }

                const firstName = (profile.full_name || "").trim().split(/\s+/)[0] || undefined;
                // Idempotency includes invoice.id + attempt_count so repeated failures
                // (e.g. Stripe Smart Retries) send up to one email per attempt.
                const attempt = (invoice as any).attempt_count ?? 1;
                await supabase.functions.invoke("send-transactional-email", {
                  body: {
                    templateName: "payment-failed",
                    recipientEmail: profile.email,
                    idempotencyKey: `payment-failed-${invoice.id}-${attempt}`,
                    templateData: {
                      firstName,
                      stripeCustomerPortalUrl: portalUrl,
                    },
                  },
                }).catch((err: any) => logStep("payment-failed email failed", { error: err }));
              }
            }
          } catch (err) {
            logStep("Error dispatching payment-failed email", { error: err });
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

        const updPayload: Record<string, unknown> = {
          status: dbStatus,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        };
        const subPrice = subscription.items?.data?.[0]?.price;
        if (subPrice?.unit_amount) {
          updPayload.amount_cents = subPrice.unit_amount;
          updPayload.currency = subPrice.currency;
          updPayload.billing_interval = subPrice.recurring?.interval ?? "month";
        }
        const { error } = await supabase
          .from("subscriptions")
          .update(updPayload)
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          logStep("Error updating subscription status", { error });
        } else {
          logStep(`Subscription updated to ${dbStatus}`);
        }

        // Sync seats_paid from Stripe quantity (if owner changed via Customer Portal)
        try {
          const quantity = subscription.items?.data?.[0]?.quantity ?? 1;
          const { data: subRow } = await supabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          if (subRow?.user_id) {
            const { data: orgRow } = await supabase
              .from("organizations")
              .select("id, seats_paid")
              .eq("owner_id", subRow.user_id)
              .maybeSingle();

            if (orgRow && orgRow.seats_paid !== quantity) {
              const { error: orgErr } = await supabase
                .from("organizations")
                .update({ seats_paid: quantity })
                .eq("id", orgRow.id);
              if (orgErr) {
                logStep("Error syncing seats_paid", { error: orgErr });
              } else {
                logStep("seats_paid synced from Stripe", { orgId: orgRow.id, quantity });
              }
            }
          }
        } catch (e) {
          logStep("Seats sync exception", { error: e instanceof Error ? e.message : String(e) });
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
