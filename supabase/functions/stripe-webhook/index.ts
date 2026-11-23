import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendMetaEvent } from "../_shared/meta-capi.ts";
import {
  applyStripeSubscription,
  invoiceSubscriptionId,
  resolveUserId,
} from "../_shared/stripe-subscription-sync.ts";

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
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;
        const plan = subscription.metadata?.plan || "mindmed_pro";
        const customerId = subscription.customer as string;
        const stripeStatus = subscription.status;

        logStep("Subscription created", { userId, subscriptionId: subscription.id, stripeStatus, plan });

        if (userId) {
          const result = await applyStripeSubscription(supabase, subscription, userId);
          logStep("Subscription synced", { status: result.status });
        }

        if (userId && stripeStatus === "trialing") {
          // Meta CAPI — início de trial
          try {
            const customer = await stripe.customers.retrieve(customerId);
            const email = (customer as Stripe.Customer)?.email ?? undefined;
            const phone = (customer as Stripe.Customer)?.phone ?? undefined;
            await sendMetaEvent({
              eventName: "StartTrial",
              eventId: `trial_${subscription.id}`,
              value: 0,
              currency: "BRL",
              actionSource: "system_generated",
              userData: {
                email,
                phone,
                externalId: userId,
                fbc: subscription.metadata?.fbc,
                fbp: subscription.metadata?.fbp,
              },
              customData: { plan },
            });
          } catch (e) {
            logStep("StartTrial CAPI failed", { error: e instanceof Error ? e.message : String(e) });
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const plan = session.metadata?.plan || "mindmed_pro";

        logStep("Checkout completed", { userId, subscriptionId, customerId, plan });

        if (userId && subscriptionId) {
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
          const result = await applyStripeSubscription(supabase, stripeSub, userId);
          logStep("Subscription synced after checkout", { status: result.status });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoiceSubscriptionId(invoice);

        logStep("Invoice paid", { subscriptionId });

        if (subscriptionId) {
          // Get subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = subscription.customer as string;

          const userId = await resolveUserId(supabase, subscription);
          const subData = userId ? { user_id: userId } : null;

          if (subData?.user_id) {
            let error: unknown = null;
            try {
              await applyStripeSubscription(supabase, subscription, subData.user_id);
            } catch (e) {
              error = e;
            }
            if (error) {
              logStep("Error updating to ACTIVE", { error });
            } else {
              logStep("Subscription updated to ACTIVE");

              // Meta CAPI — Purchase apenas na primeira fatura realmente paga
              try {
                const amountPaid = invoice.amount_paid ?? 0;
                if (amountPaid > 0) {
                  const { error: dedupError } = await supabase
                    .from("conversion_events_sent")
                    .insert({ stripe_subscription_id: subscriptionId, event_name: "Purchase" });

                  if (dedupError) {
                    logStep("Purchase already sent for subscription, skipping", { subscriptionId });
                  } else {
                    const customer = await stripe.customers.retrieve(customerId);
                    const md = subscription.metadata ?? {};
                    await sendMetaEvent({
                      eventName: "Purchase",
                      eventId: `purchase_${subscriptionId}`,
                      value: amountPaid / 100,
                      currency: (invoice.currency || "brl").toUpperCase(),
                      actionSource: "system_generated",
                      userData: {
                        email: (customer as Stripe.Customer)?.email ?? undefined,
                        phone: (customer as Stripe.Customer)?.phone ?? undefined,
                        externalId: md.user_id ?? subData.user_id,
                        fbc: md.fbc,
                        fbp: md.fbp,
                      },
                      customData: {
                        plan: md.plan ?? "",
                        utm_source: md.utm_source ?? "",
                        utm_medium: md.utm_medium ?? "",
                        utm_campaign: md.utm_campaign ?? "",
                      },
                    });
                  }
                }
              } catch (e) {
                logStep("Purchase CAPI failed", { error: e instanceof Error ? e.message : String(e) });
              }

              // Send upgrade confirmed email (only for a real charge, not the R$ 0 trial invoice)
              const { data: profile } = (invoice.amount_paid ?? 0) > 0 ? await supabase
                .from("profiles")
                .select("email, full_name")
                .eq("id", subData.user_id)
                .maybeSingle() : { data: null };

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
        const subscriptionId = invoiceSubscriptionId(invoice);
        const customerId = invoice.customer as string;

        logStep("Invoice payment failed", { subscriptionId, customerId });

        if (subscriptionId) {
          // Mirror Stripe's own status (past_due while retries run) instead of guessing.
          const failedSub = await stripe.subscriptions.retrieve(subscriptionId);
          const failedUser = await resolveUserId(supabase, failedSub);
          if (failedUser) {
            const result = await applyStripeSubscription(supabase, failedSub, failedUser);
            logStep("Subscription synced after failed payment", { status: result.status });
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

        const updatedUser = await resolveUserId(supabase, subscription);
        if (updatedUser) {
          const result = await applyStripeSubscription(supabase, subscription, updatedUser);
          logStep(`Subscription updated to ${result.status}`);
        } else {
          logStep("No user found for updated subscription", { subscriptionId });
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
