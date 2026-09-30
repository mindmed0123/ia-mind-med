// Mapa de parceiros montado a partir de secrets.
// Novo parceiro = dois secrets (PARCEIRO_TOKEN_X, STRIPE_COUPON_X) + uma linha add(...).
export type Parceiro = { cupom: string; rotulo: string; slug: string };

export const PLANOS_COM_CUPOM = ["mindmed_pro", "mindmed_pro_anual"];

export function mapaParceiros(): Record<string, Parceiro> {
  const m: Record<string, Parceiro> = {};
  const add = (token?: string, cupom?: string, rotulo?: string, slug?: string) => {
    if (token && cupom && rotulo && slug) m[token] = { cupom, rotulo, slug };
  };
  add(Deno.env.get("PARCEIRO_TOKEN_SBACV"), Deno.env.get("STRIPE_COUPON_SBACV"), "SBACV", "sbacv");
  add(Deno.env.get("PARCEIRO_TOKEN_SINDMEPA"), Deno.env.get("STRIPE_COUPON_SINDMEPA"), "SINDMEPA", "sindmepa");
  return m;
}

export function resolverParceiro(token: unknown): Parceiro | undefined {
  if (typeof token !== "string" || !token || token.length > 100) return undefined;
  return mapaParceiros()[token];
}
