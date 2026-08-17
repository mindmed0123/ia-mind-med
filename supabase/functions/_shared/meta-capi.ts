/**
 * Envio de eventos server-side para a Meta Conversions API.
 * Nunca lança exceção: falha de tracking não pode quebrar pagamento.
 */

export interface CapiUserData {
  email?: string;
  phone?: string;
  fbc?: string;
  fbp?: string;
  clientIp?: string;
  userAgent?: string;
  externalId?: string;
}

export interface CapiEvent {
  eventName: "Purchase" | "StartTrial" | "Subscribe";
  eventId: string;
  eventTime?: number;
  value?: number;
  currency?: string;
  userData: CapiUserData;
  customData?: Record<string, string | number>;
  actionSource?: "website" | "system_generated";
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendMetaEvent(ev: CapiEvent): Promise<void> {
  try {
    const pixelId = Deno.env.get("META_PIXEL_ID");
    const accessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN");
    if (!pixelId || !accessToken) {
      console.log("[META-CAPI] skipped: META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set");
      return;
    }

    const u = ev.userData ?? {};
    const user_data: Record<string, unknown> = {};

    if (u.email) user_data.em = [await sha256Hex(u.email.trim().toLowerCase())];
    if (u.phone) {
      const p = normalizePhone(u.phone);
      if (p) user_data.ph = [await sha256Hex(p)];
    }
    if (u.externalId) user_data.external_id = [await sha256Hex(u.externalId.trim().toLowerCase())];
    if (u.fbc) user_data.fbc = u.fbc;
    if (u.fbp) user_data.fbp = u.fbp;
    if (u.clientIp) user_data.client_ip_address = u.clientIp;
    if (u.userAgent) user_data.client_user_agent = u.userAgent;

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: ev.eventName,
          event_id: ev.eventId,
          event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
          action_source: ev.actionSource ?? "system_generated",
          user_data,
          custom_data: {
            ...(ev.value != null ? { value: ev.value } : {}),
            ...(ev.currency ? { currency: ev.currency } : {}),
            ...(ev.customData ?? {}),
          },
        },
      ],
    };

    const testCode = Deno.env.get("META_CAPI_TEST_CODE");
    if (testCode) body.test_event_code = testCode;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const text = await res.text();
      if (!res.ok) {
        console.error("[META-CAPI] error response", { status: res.status, body: text.slice(0, 500) });
      } else {
        console.log("[META-CAPI] sent", { event: ev.eventName, eventId: ev.eventId });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[META-CAPI] failed", err instanceof Error ? err.message : String(err));
  }
}
