export const SUBSCRIPTION_PLANS = [
  { id: 'mindmed_starter', label: 'Starter', price: 'R$ 149/mês', badge: null as string | null },
  { id: 'mindmed_pro', label: 'Pro', price: 'R$ 299/mês', badge: 'Recomendado' },
  { id: 'mindmed_pro_anual', label: 'Pro anual', price: 'R$ 2.990/ano', badge: '2 meses grátis' },
] as const;

export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLANS)[number]['id'];

export const VALID_SUBSCRIPTION_PLAN_IDS: readonly string[] = SUBSCRIPTION_PLANS.map((plan) => plan.id);

export function getSubscriptionPlanId(plan: string | undefined, billingCycle: string | undefined): SubscriptionPlanId {
  if (plan === 'STARTER') return 'mindmed_starter';
  if (plan === 'PRO' && billingCycle === 'ANNUAL') return 'mindmed_pro_anual';
  return 'mindmed_pro';
}