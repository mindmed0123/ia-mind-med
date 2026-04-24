// Shared helper for LLM calls with retry, timeout, and automatic fallback.
// Used by generate-laudo, summarize-chunk and consolidate-summaries.
//
// Strategy:
// 1. Try primary model with a generous timeout (default 60s).
// 2. On AbortError / 5xx / 429 → retry once with exponential backoff.
// 3. If still failing → fall back to a lighter model.
// 4. Returns the parsed JSON response from the AI Gateway, or throws.

export interface LlmCallOptions {
  model: string;
  fallbackModel?: string;
  messages: Array<{ role: string; content: string }>;
  tools?: unknown[];
  toolChoice?: unknown;
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
  retries?: number;
}

export interface LlmCallResult {
  data: any;
  modelUsed: string;
  attempts: number;
  totalMs: number;
  fellBack: boolean;
}

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callOnce(
  apiKey: string,
  model: string,
  opts: LlmCallOptions,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: any; latencyMs: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("llm_timeout"), timeoutMs);
  const t0 = Date.now();
  try {
    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        ...(opts.tools ? { tools: opts.tools } : {}),
        ...(opts.toolChoice ? { tool_choice: opts.toolChoice } : {}),
        max_tokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.15,
      }),
      signal: ctrl.signal,
    });
    const latencyMs = Date.now() - t0;
    if (!resp.ok) {
      const errBody = await resp.text();
      return { ok: false, status: resp.status, body: errBody, latencyMs };
    }
    const data = await resp.json();
    return { ok: true, status: 200, body: data, latencyMs };
  } catch (e: any) {
    const latencyMs = Date.now() - t0;
    return {
      ok: false,
      status: e?.name === "AbortError" ? 408 : 0,
      body: e?.message || "fetch_error",
      latencyMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callLlmWithFallback(
  apiKey: string,
  opts: LlmCallOptions,
  log: (step: string, data?: Record<string, unknown>) => void,
): Promise<LlmCallResult> {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const retries = opts.retries ?? 1;
  const t0 = Date.now();

  // Try primary model with retries
  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await callOnce(apiKey, opts.model, opts, timeoutMs);
    log("llm_attempt", {
      model: opts.model,
      attempt,
      ok: result.ok,
      status: result.status,
      latency_ms: result.latencyMs,
    });
    if (result.ok) {
      return {
        data: result.body,
        modelUsed: opts.model,
        attempts: attempt + 1,
        totalMs: Date.now() - t0,
        fellBack: false,
      };
    }
    lastErr = result;
    // Don't retry on quota/payment errors — fall back immediately
    if (result.status === 402) break;
    // Backoff before retry
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  // Fallback model
  if (opts.fallbackModel && opts.fallbackModel !== opts.model) {
    log("llm_fallback", { from: opts.model, to: opts.fallbackModel });
    const result = await callOnce(apiKey, opts.fallbackModel, opts, timeoutMs);
    log("llm_attempt", {
      model: opts.fallbackModel,
      attempt: "fallback",
      ok: result.ok,
      status: result.status,
      latency_ms: result.latencyMs,
    });
    if (result.ok) {
      return {
        data: result.body,
        modelUsed: opts.fallbackModel,
        attempts: retries + 2,
        totalMs: Date.now() - t0,
        fellBack: true,
      };
    }
    lastErr = result;
  }

  const err = new Error(
    `LLM call failed after retries+fallback: status=${lastErr?.status} body=${
      typeof lastErr?.body === "string" ? lastErr.body.slice(0, 200) : ""
    }`,
  );
  (err as any).status = lastErr?.status;
  throw err;
}
