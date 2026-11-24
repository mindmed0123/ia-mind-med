/**
 * Registro do que o médico faz com os documentos (copiar, baixar, imprimir, assinar).
 * Fica gravado em nome dele, com data, hora e a impressão digital (SHA-256) do conteúdo.
 */
import { supabase } from '@/integrations/supabase/client';

export type ActivityAction = 'COPY' | 'DOWNLOAD' | 'PRINT' | 'SIGN' | 'SAVE';
export type ActivityEntity = 'REPORT' | 'PRESCRIPTION' | 'PATIENT' | 'EVOLUTION' | 'DOCUMENT';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sha256Hex(data: string | Blob | ArrayBuffer | Uint8Array): Promise<string> {
  let buf: ArrayBuffer;
  if (typeof data === 'string') buf = new TextEncoder().encode(data).buffer as ArrayBuffer;
  else if (data instanceof Blob) buf = await data.arrayBuffer();
  else if (data instanceof Uint8Array) buf = data.slice().buffer as ArrayBuffer;
  else buf = data;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ActivityInput {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string | null;
  content?: string | Blob | ArrayBuffer | Uint8Array | null;
  details?: Record<string, unknown>;
}

/** Grava a ação. Nunca interrompe o médico: falhas ficam só no console. */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    const hash = input.content != null ? await sha256Hex(input.content) : null;
    const entityId = input.entityId && UUID_RE.test(input.entityId) ? input.entityId : null;
    const details = {
      ...input.details,
      pagina: typeof window !== 'undefined' ? window.location.pathname : undefined,
      registrado_em_cliente: new Date().toISOString(),
    };
    const send = (id: string | null, extra: Record<string, unknown> = {}) =>
      supabase.rpc('log_document_activity', {
        p_action: input.action,
        p_entity: input.entity,
        p_entity_id: id as string,
        p_content_hash: hash as string,
        p_details: { ...details, ...extra } as never,
      });
    let { error } = await send(entityId);
    // Identificador da página que não é um documento do médico: registra mesmo assim, sem vínculo.
    if (error && entityId && /not_owner/.test(error.message)) {
      ({ error } = await send(null, { vinculo_descartado: true }));
    }
    if (error) console.warn('Registro de atividade não gravado:', error.message);
  } catch (e) {
    console.warn('Registro de atividade não gravado:', (e as Error).message);
  }
}

/** Copia um texto para a área de transferência e registra a cópia. */
export async function copyWithRecord(
  text: string,
  ctx: { entity: ActivityEntity; entityId?: string | null; label?: string }
): Promise<void> {
  await navigator.clipboard.writeText(text);
  notifyCopyRecorded();
  void logActivity({
    action: 'COPY',
    entity: ctx.entity,
    entityId: ctx.entityId,
    content: text,
    details: { origem: 'botao_copiar', rotulo: ctx.label, caracteres: text.length },
  });
}

// Aviso discreto, no máximo um a cada 30 segundos.
let lastNotice = 0;
type Notifier = () => void;
let notifier: Notifier | null = null;
export function registerCopyNotifier(n: Notifier | null) {
  notifier = n;
}
export function notifyCopyRecorded() {
  const now = Date.now();
  if (now - lastNotice < 30_000) return;
  lastNotice = now;
  notifier?.();
}
