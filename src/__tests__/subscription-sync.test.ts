import { describe, it, expect } from 'vitest';
import { needsStripeSync, rowHasAccess, STRIPE_SYNC_INTERVAL_MS } from '@/lib/subscription-sync';

const NOW = new Date('2026-11-23T12:00:00Z').getTime();

describe('confirmação da assinatura com o Stripe', () => {
  it('confirma com o Stripe quando o médico ainda aparece sem cartão (volta do checkout)', () => {
    expect(needsStripeSync({ status: 'PENDING_CHECKOUT' }, null, NOW)).toBe(true);
  });

  it('confirma quando o teste grátis venceu no app (o Stripe pode já ter cobrado)', () => {
    const row = { status: 'TRIALING', trial_end: '2026-11-20T00:00:00Z', stripe_subscription_id: 'sub_1' };
    expect(rowHasAccess(row, NOW)).toBe(false);
    expect(needsStripeSync(row, null, NOW)).toBe(true);
  });

  it('nunca consulta o Stripe para o acesso de cortesia do admin', () => {
    expect(needsStripeSync({ status: 'ACTIVE', plan_origem: 'courtesy_admin', stripe_subscription_id: 'sub_x' }, null, NOW)).toBe(false);
  });

  it('não repete a consulta antes de 30 minutos', () => {
    expect(STRIPE_SYNC_INTERVAL_MS).toBe(30 * 60 * 1000);
    expect(needsStripeSync({ status: 'PENDING_CHECKOUT' }, NOW - 10 * 60 * 1000, NOW)).toBe(false);
    expect(needsStripeSync({ status: 'PENDING_CHECKOUT' }, NOW - 31 * 60 * 1000, NOW)).toBe(true);
  });

  it('teste grátis fora do Stripe (VIP) e ainda válido não depende do Stripe', () => {
    expect(needsStripeSync({ status: 'TRIALING', trial_end: '2026-11-30T00:00:00Z' }, null, NOW)).toBe(false);
  });
});
