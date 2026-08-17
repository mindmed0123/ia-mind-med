/**
 * URL pública do produto usada por todos os templates de e-mail.
 * Configurável via APP_PUBLIC_URL, com fallback para o domínio de produção.
 */
export const APP_URL: string =
  (globalThis as any).Deno?.env?.get?.('APP_PUBLIC_URL') ?? 'https://acesso.mindmed.online'

export const GUARANTEE_TEXT =
  'Garantia de 30 dias: se depois da primeira cobrança você não estiver satisfeito, devolvemos 100% do valor. Basta responder este e-mail.'
