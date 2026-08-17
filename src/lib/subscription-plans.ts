export const SUBSCRIPTION_PLANS = [
  {
    id: 'mindmed_starter',
    label: 'Starter',
    price: 'R$ 149/mês',
    priceValue: 149,
    badge: null as string | null,
    recommended: false,
    description: 'Para quem faz até 30 consultas por mês',
    features: [
      'Até 30 laudos por mês',
      'Transcrição de consulta por áudio',
      'Laudo estruturado com CID-10',
      'Exportação em PDF assinado',
      'Suporte por WhatsApp',
    ],
  },
  {
    id: 'mindmed_pro',
    label: 'Pro',
    price: 'R$ 299/mês',
    priceValue: 299,
    badge: 'Recomendado' as string | null,
    recommended: true,
    description: 'Para quem atende todos os dias',
    features: [
      'Laudos ilimitados',
      'Receituário automático com IA',
      'MindChat — copiloto clínico',
      'Relatórios de evolução do paciente',
      'Telemedicina e agenda',
      'Suporte prioritário',
    ],
  },
  {
    id: 'mindmed_pro_anual',
    label: 'Pro anual',
    price: 'R$ 2.990/ano',
    priceValue: 2990,
    badge: '2 meses grátis' as string | null,
    recommended: false,
    description: 'Todo o plano Pro, com 2 meses grátis',
    features: [
      'Tudo do plano Pro',
      'Equivalente a R$ 249/mês',
      '2 meses grátis no ano',
      'Preço travado por 12 meses',
    ],
  },
] as const;

export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLANS)[number]['id'];

export const VALID_SUBSCRIPTION_PLAN_IDS: readonly string[] = SUBSCRIPTION_PLANS.map((plan) => plan.id);

export const STARTER_PLAN = SUBSCRIPTION_PLANS[0];
export const PRO_PLAN = SUBSCRIPTION_PLANS[1];
export const PRO_ANNUAL_PLAN = SUBSCRIPTION_PLANS[2];

export const GUARANTEE_TEXT =
  'Garantia de 30 dias. Se você não estiver satisfeito depois da primeira cobrança, devolvemos 100% do valor.';

export function getSubscriptionPlanId(plan: string | undefined, billingCycle: string | undefined): SubscriptionPlanId {
  if (plan === 'STARTER') return 'mindmed_starter';
  if (plan === 'PRO' && billingCycle === 'ANNUAL') return 'mindmed_pro_anual';
  return 'mindmed_pro';
}
