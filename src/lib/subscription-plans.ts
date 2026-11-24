// Planos à venda (modelo Free → Pro → Business). Starter e Fundador saíram da
// venda; quem já assinou continua com o plano dele.
export const SUBSCRIPTION_PLANS = [
  {
    id: 'mindmed_pro',
    label: 'Pro Mensal',
    price: 'R$ 299/mês',
    priceValue: 299,
    badge: null as string | null,
    recommended: false,
    description: 'Tudo ilimitado, cobrança mensal',
    nota: undefined as string | undefined,
    features: [
      'Consultas documentadas ilimitadas',
      'MindChat ilimitado',
      'Receituário, evolução do paciente e telemedicina',
      'Cancele quando quiser, pelo próprio painel',
    ],
  },
  {
    id: 'mindmed_pro_anual',
    label: 'Pro Anual',
    price: 'R$ 2.388/ano',
    priceValue: 2388,
    badge: 'Economize R$ 1.200' as string | null,
    recommended: true,
    description: 'Equivale a R$ 199/mês',
    nota: 'Equivale a R$ 199/mês · economia de R$ 1.200 no ano' as string | undefined,
    features: [
      'Tudo do Pro Mensal',
      'Equivale a R$ 199/mês',
      'Economia de R$ 1.200 no ano',
      'Preço travado por 12 meses',
    ],
  },
] as const;

export const FREE_PLAN = {
  id: 'mindmed_free',
  label: 'Free',
  price: 'R$ 0',
  laudosPorMes: 5,
  chatPorMes: 10,
} as const;

export const BUSINESS_WHATSAPP_URL = 'https://wa.me/5511958890212';

export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLANS)[number]['id'];

export const VALID_SUBSCRIPTION_PLAN_IDS: readonly string[] = SUBSCRIPTION_PLANS.map((plan) => plan.id);

export const PRO_PLAN = SUBSCRIPTION_PLANS[0];
export const PRO_ANNUAL_PLAN = SUBSCRIPTION_PLANS[1];

export const GUARANTEE_TEXT =
  'Garantia de 30 dias. Se você não estiver satisfeito depois da primeira cobrança, devolvemos 100% do valor.';

/** Converte o `?plan=` vindo do site (pro_mensal / pro_anual) no plano do checkout. */
export function planFromSiteParam(param?: string | null): SubscriptionPlanId | null {
  if (param === 'pro_mensal') return 'mindmed_pro';
  if (param === 'pro_anual') return 'mindmed_pro_anual';
  return null;
}

export function getSubscriptionPlanId(
  _plan?: string,
  billingCycle?: string,
  planOrigem?: string
): SubscriptionPlanId {
  if (planOrigem && VALID_SUBSCRIPTION_PLAN_IDS.includes(planOrigem)) {
    return planOrigem as SubscriptionPlanId;
  }
  if (billingCycle === 'ANNUAL') return 'mindmed_pro_anual';
  return 'mindmed_pro_anual';
}
