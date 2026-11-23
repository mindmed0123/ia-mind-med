// Single source for mirroring a Stripe subscription onto public.subscriptions.
// Used by stripe-webhook and sync-subscription so both paths write the same
// status, plan, trial and period fields.
import type Stripe from "https://esm.sh/stripe@18.5.0";

// deno-lint-ignore no-explicit-any
type Db = any;

const PLAN_TO_DB: Record<string, "STARTER" | "PRO"> = {
  mindmed_starter: "STARTER",
  mindmed_pro: "PRO",
  mindmed_pro_anual: "PRO",
  mindmed_fundador: "PRO",
};

export function knownPriceIds(): Set<string> {
  return new Set(
    [
      "STRIPE_PRICE_STARTER_MONTHLY",
      "STRIPE_PRICE_PRO_MONTHLY",
      "STRIPE_PRICE_PRO_ANNUAL",
      "STRIPE_PRICE_FUNDADOR",
    ].map((k) => Deno.env.get(k)).filter((v): v is string => !!v),
  );
}

function planFromPrice(priceId: string | undefined): string | null {
  if (!priceId) return null;
  const map: Record<string, string> = {
    STRIPE_PRICE_STARTER_MONTHLY: "mindmed_starter",
    STRIPE_PRICE_PRO_MONTHLY: "mindmed_pro",
    STRIPE_PRICE_PRO_ANNUAL: "mindmed_pro_anual",
    STRIPE_PRICE_FUNDADOR: "mindmed_fundador",
  };
  for (const [env, plan] of Object.entries(map)) {
    if (Deno.env.get(env) === priceId) return plan;
  }
  return null;
}

const toIso = (sec: number | null | undefined) =>
  typeof sec === "number" && sec > 0 ? new Date(sec * 1000).toISOString() : null;

/** Since API 2025-03-31.basil the billing period lives on the subscription item. */
export function subscriptionPeriod(sub: Stripe.Subscription) {
  // deno-lint-ignore no-explicit-any
  const item = sub.items?.data?.[0] as any;
  // deno-lint-ignore no-explicit-any
  const legacy = sub as any;
  return {
    start: toIso(item?.current_period_start ?? legacy.current_period_start),
    end: toIso(item?.current_period_end ?? legacy.current_period_end),
  };
}

/** Since basil the invoice's subscription lives under parent.subscription_details. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;
  const fromParent = inv.parent?.subscription_details?.subscription;
  const raw = fromParent ?? inv.subscription ?? null;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id ?? null;
}

export function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing": return "TRIALING";
    case "active": return "ACTIVE";
    case "past_due": return "PAST_DUE";
    case "incomplete": return "PENDING_CHECKOUT";
    case "canceled": return "CANCELED";
    default: return "INACTIVE"; // incomplete_expired, unpaid, paused
  }
}

/** Priority used when a customer has several subscriptions. */
export function pickSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const rank = (s: Stripe.Subscription) =>
    s.status === "active" || s.status === "trialing" ? 0 : s.status === "past_due" ? 1 : 2;
  return [...subs].sort((a, b) => rank(a) - rank(b) || b.created - a.created)[0] ?? null;
}

export interface ApplyResult {
  status: string;
  updated: boolean;
  isNewSubscription: boolean;
  skipped?: "courtesy";
}

/**
 * Writes the Stripe subscription state onto the user's row. Never touches a
 * courtesy (admin-granted) row. Quotas reset only when the subscription is new.
 */
export async function applyStripeSubscription(
  supabase: Db,
  sub: Stripe.Subscription,
  userId: string,
): Promise<ApplyResult> {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, plan_origem, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.plan_origem === "courtesy_admin") {
    return { status: existing.status, updated: false, isNewSubscription: false, skipped: "courtesy" };
  }

  const price = sub.items?.data?.[0]?.price;
  const plan = (sub.metadata?.plan && PLAN_TO_DB[sub.metadata.plan] ? sub.metadata.plan : null) ??
    planFromPrice(price?.id) ?? "mindmed_pro";
  const period = subscriptionPeriod(sub);
  const status = mapStripeStatus(sub.status);
  const isNewSubscription = existing?.stripe_subscription_id !== sub.id;

  const payload: Record<string, unknown> = {
    user_id: userId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    status,
    plan: PLAN_TO_DB[plan] ?? "PRO",
    plan_origem: plan,
    billing_cycle: price?.recurring?.interval === "year" ? "ANNUAL" : "MONTHLY",
    trial_start: toIso(sub.trial_start),
    trial_end: toIso(sub.trial_end),
    current_period_start: period.start,
    current_period_end: period.end,
    payment_provider: "stripe",
    ...(price?.unit_amount != null ? {
      amount_cents: price.unit_amount,
      currency: price.currency,
      billing_interval: price.recurring?.interval ?? "month",
    } : {}),
    ...(isNewSubscription ? {
      quota_used: 0,
      remaining_starter_credits: plan === "mindmed_starter" ? 10 : null,
    } : {}),
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id", ignoreDuplicates: false });
  if (error) throw new Error(`subscription upsert failed: ${error.message}`);

  return { status, updated: true, isNewSubscription };
}

/** Finds the user id for a subscription: metadata first, then the stored link. */
export async function resolveUserId(supabase: Db, sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .or(`stripe_subscription_id.eq.${sub.id}${customerId ? `,stripe_customer_id.eq.${customerId}` : ""}`)
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}
