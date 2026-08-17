/**
 * Captura e persistência de atribuição de campanha (first-touch, 90 dias).
 *
 * A landing fica em mindmed.online e este app em acesso.mindmed.online:
 * domínios diferentes, então localStorage e os cookies _fbp/_fbc não
 * atravessam. A landing repassa os parâmetros na querystring e este módulo
 * os lê aqui para não perder o rastro.
 */

const STORAGE_KEY = "mm_attr";
const TTL_DAYS = 90;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

const KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

const ALL_KEYS = [...KEYS, "mm_lp"] as const;

export type Attribution = Partial<Record<(typeof ALL_KEYS)[number], string>> & {
  landing_path?: string;
  referrer?: string;
  first_seen_at?: string;
};

const isBrowser = () => typeof window !== "undefined";

function readStored(): Attribution | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(attr: Attribution | null): boolean {
  if (!attr?.first_seen_at) return false;
  const ts = Date.parse(attr.first_seen_at);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < TTL_MS;
}

function write(attr: Attribution): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attr));
  } catch {
    /* storage bloqueado (janela anônima) — segue sem persistir */
  }
}

function readCookie(name: string): string | undefined {
  if (!isBrowser()) return undefined;
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lê os parâmetros de campanha da URL e persiste (first-touch, 90 dias).
 * Chamar uma vez no boot da aplicação.
 */
export function captureAttribution(): void {
  if (!isBrowser()) return;

  try {
    const params = new URLSearchParams(window.location.search);
    const found: Attribution = {};

    for (const key of ALL_KEYS) {
      const value = params.get(key);
      if (value) found[key] = value.slice(0, 200);
    }

    const hasCampaignData = Object.keys(found).length > 0;

    // fbclid presente mas cookie _fbc ainda não gravado pelo Pixel
    if (found.fbclid && !readCookie("_fbc")) {
      const fbc = `fb.1.${Date.now()}.${found.fbclid}`;
      try {
        document.cookie = `_fbc=${fbc}; path=/; max-age=${TTL_DAYS * 24 * 60 * 60}`;
      } catch {
        /* ignore */
      }
    }

    const stored = readStored();
    if (!hasCampaignData) return;
    if (isFresh(stored)) return; // first-touch: não sobrescreve

    found.landing_path = window.location.pathname;
    try {
      found.referrer = document.referrer ? new URL(document.referrer).hostname : undefined;
    } catch {
      found.referrer = undefined;
    }
    found.first_seen_at = new Date().toISOString();

    write(found);
  } catch {
    /* tracking nunca pode quebrar a aplicação */
  }
}

/** Retorna a atribuição salva (ou objeto vazio). Nunca lança exceção. */
export function getAttribution(): Attribution {
  if (!isBrowser()) return {};
  const stored = readStored();
  if (!stored) return {};
  if (!isFresh(stored)) return {};
  return stored;
}

/** Lê os cookies _fbc e _fbp que o Pixel grava. Usados pela Conversions API. */
export function getFbCookies(): { fbc?: string; fbp?: string } {
  if (!isBrowser()) return {};
  return { fbc: readCookie("_fbc"), fbp: readCookie("_fbp") };
}
