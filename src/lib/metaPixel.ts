// Meta Pixel helper - dispara eventos com value > 0 (Purchase com value:0 é ignorado pelo Meta)
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export const trackSignupPurchase = (source: 'free' | 'trial_15d' = 'free') => {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    console.warn('[MetaPixel] fbq não está disponível');
    return;
  }

  const eventID = `signup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const value = source === 'trial_15d' ? 299.0 : 99.9;
  const content_name =
    source === 'trial_15d'
      ? 'Cadastro Médico - Trial 15 dias PRO'
      : 'Cadastro Médico - Conta Grátis';

  try {
    window.fbq('track', 'Lead', { content_category: 'signup' }, { eventID: `lead_${eventID}` });
    window.fbq(
      'track',
      'Purchase',
      {
        value,
        currency: 'BRL',
        content_name,
        content_category: source === 'trial_15d' ? 'signup_trial' : 'signup',
        content_type: 'product',
        contents: [{ id: source, quantity: 1, item_price: value }],
      },
      { eventID: `purchase_${eventID}` }
    );
    console.log('[MetaPixel] Purchase disparado', { source, value, eventID });
  } catch (err) {
    console.error('[MetaPixel] erro ao disparar evento', err);
  }
};

// Expor globalmente para disparo manual de teste no console: window.__firePixelTest()
if (typeof window !== 'undefined') {
  (window as any).__firePixelTest = () => trackSignupPurchase('free');
}
