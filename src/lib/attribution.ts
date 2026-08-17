/**
 * Stub temporário de atribuição (UTMs, click IDs, origem).
 * Será implementado no Prompt 2 — por enquanto retorna um objeto vazio.
 */
export type Attribution = Partial<
  Record<
    | "utm_source"
    | "utm_medium"
    | "utm_campaign"
    | "utm_content"
    | "utm_term"
    | "fbclid"
    | "gclid"
    | "mm_lp"
    | "landing_path"
    | "referrer",
    string
  >
>;

export function getAttribution(): Attribution {
  return {};
}
