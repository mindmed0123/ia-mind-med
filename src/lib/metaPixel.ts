/**
 * Eventos de navegador (Meta Pixel + GA4).
 *
 * Purchase NÃO existe aqui: compra é evento de servidor, enviado
 * exclusivamente pela Conversions API a partir do webhook do Stripe.
 * Payload sempre neutro (sem termos clínicos) e sem value/currency.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    gtag?: (...args: any[]) => void;
    __mmPixelFired?: Record<string, number>;
  }
}

const DEDUP_WINDOW_MS = 5000;

function shouldFire(key: string): boolean {
  if (typeof window === "undefined") return false;
  window.__mmPixelFired = window.__mmPixelFired || {};
  const now = Date.now();
  const last = window.__mmPixelFired[key] || 0;
  if (now - last < DEDUP_WINDOW_MS) return false;
  window.__mmPixelFired[key] = now;
  return true;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fbqTrack(eventName: string, params: Record<string, string>, eventId: string): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    window.fbq("track", eventName, params, { eventID: eventId });
  } catch {
    /* tracking nunca pode quebrar a aplicação */
  }
}

/** Dispara um evento no GA4, quando disponível. */
export function trackGA4(eventName: string, params: Record<string, string> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", eventName, params);
  } catch {
    /* noop */
  }
}

/** Landing ou página de planos carregada. */
export function trackViewContent(contentName: string): void {
  const name = slug(contentName);
  if (!shouldFire(`view_${name}`)) return;
  fbqTrack("ViewContent", { content_name: name, content_category: "signup" }, `view_${name}`);
  trackGA4("view_content", { content_name: name });
}

/** Usuário clicou no CTA que leva ao checkout. */
export function trackInitiateCheckout(plan: string): void {
  const p = slug(plan);
  if (!shouldFire(`checkout_${p}`)) return;
  fbqTrack("InitiateCheckout", { content_name: p, content_category: "signup" }, `checkout_${p}`);
  trackGA4("initiate_checkout", { plan: p });
}

/**
 * Conta criada com sucesso — evento de topo de funil.
 * @param userId id do Supabase; usado como eventId determinístico.
 */
export function trackLead(userId: string): void {
  if (!userId) return;
  if (!shouldFire(`lead_${userId}`)) return;
  fbqTrack("Lead", { content_category: "signup" }, `lead_${userId}`);
  trackGA4("lead", { user_id: userId });
}
