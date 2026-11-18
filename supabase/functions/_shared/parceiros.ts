// Mapa de parceiros montado a partir de secrets.
// Novo parceiro = dois secrets (PARCEIRO_TOKEN_X, STRIPE_COUPON_X) + uma linha add(...)
// + a entrada correspondente em parceiro-restricoes.ts.
import { CATALOGO_PARCEIROS, infoParceiroPorSlug } from "./parceiro-restricoes.ts";

export type Parceiro = {
  cupom: string;
  rotulo: string;
  slug: string;
  /** true = contas deste parceiro só podem usar modelos com inferencia: false */
  somenteDocumentacao?: boolean;
};

export const PLANOS_COM_CUPOM = ["mindmed_pro", "mindmed_pro_anual"];

export function mapaParceiros(): Record<string, Parceiro> {
  const m: Record<string, Parceiro> = {};
  const add = (token?: string, cupom?: string, rotulo?: string, slug?: string, somenteDocumentacao = false) => {
    if (token && cupom && rotulo && slug) m[token] = { cupom, rotulo, slug, somenteDocumentacao };
  };
  add(Deno.env.get("PARCEIRO_TOKEN_SBACV"),    Deno.env.get("STRIPE_COUPON_SBACV"),    "SBACV",    "sbacv");
  add(Deno.env.get("PARCEIRO_TOKEN_SINDMEPA"), Deno.env.get("STRIPE_COUPON_SINDMEPA"), "SINDMEPA", "sindmepa", true);
  return m;
}

export function resolverParceiro(token: unknown): Parceiro | undefined {
  if (typeof token !== "string" || !token || token.length > 100) return undefined;
  return mapaParceiros()[token];
}

/** Resolve pelo slug gravado no perfil. Não depende dos secrets: a restrição vale mesmo sem cupom configurado. */
export function parceiroPorSlug(slug?: string | null): Parceiro | undefined {
  const info = infoParceiroPorSlug(slug);
  if (!info) return undefined;
  const cupom = Object.values(mapaParceiros()).find((p) => p.slug === info.slug)?.cupom ?? "";
  return { cupom, rotulo: info.rotulo, slug: info.slug, somenteDocumentacao: info.somenteDocumentacao };
}

export { CATALOGO_PARCEIROS };
