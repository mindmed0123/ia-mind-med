// Meta Pixel helper - dispara eventos com value > 0 (Purchase com value:0 é ignorado pelo Meta)
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    __firePixelTest?: () => void;
    __mmPixelFired?: Record<string, number>;
  }
}

const DEDUP_WINDOW_MS = 5000;

function shouldFire(key: string): boolean {
  if (typeof window === 'undefined') return false;
  window.__mmPixelFired = window.__mmPixelFired || {};
  const now = Date.now();
  const last = window.__mmPixelFired[key] || 0;
  if (now - last < DEDUP_WINDOW_MS) return false;
  window.__mmPixelFired[key] = now;
  return true;
}

export const trackSignupIntent = (source: 'free' | 'trial_15d' = 'free') => {
  if (!shouldFire(`intent_${source}`)) return;
  fireSignupPurchase(source, 'intent');
};

export const trackSignupPurchase = (source: 'free' | 'trial_15d' = 'free') => {
  if (!shouldFire(`success_${source}`)) return;
  fireSignupPurchase(source, 'success');
};

function fireSignupPurchase(source: 'free' | 'trial_15d', stage: 'intent' | 'success') {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    console.warn('[MetaPixel] fbq não está disponível');
    return;
  }

  const eventID = `signup_${source}_${stage}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const value = source === 'trial_15d' ? 299.0 : 99.9;
  const content_name =
    source === 'trial_15d'
      ? 'Cadastro Médico - Trial 15 dias PRO'
      : 'Cadastro Médico - Conta Grátis';

  try {
    window.fbq('track', 'Lead', { content_category: 'signup', stage }, { eventID: `lead_${eventID}` });
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
        stage,
      },
      { eventID: `purchase_${eventID}` }
    );
    console.log('[MetaPixel] Purchase disparado', { source, stage, value, eventID });
  } catch (err) {
    console.error('[MetaPixel] erro ao disparar evento', err);
  }
}

// Expor globalmente para disparo manual de teste no console: window.__firePixelTest()
if (typeof window !== 'undefined') {
  window.__firePixelTest = () => fireSignupPurchase('free', 'success');
}

