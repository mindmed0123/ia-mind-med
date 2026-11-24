/**
 * Entrega de todo PDF baixado pelo médico:
 * 1. assina com o certificado A1 dele (se ele tiver aberto ou abrir agora);
 * 2. baixa;
 * 3. registra o download (e a assinatura) em nome dele.
 */
import { supabase } from '@/integrations/supabase/client';
import { downloadPdf } from '@/lib/pdf-generator';
import { logActivity, type ActivityEntity } from '@/lib/activity-log';
import { requestSigner } from '@/lib/signature/certificate-store';
import { toast } from '@/hooks/use-toast';

export interface DeliverContext {
  entity: ActivityEntity;
  entityId?: string | null;
  /** Ex.: "Laudo", "Receituário" — aparece na janela do certificado e no motivo da assinatura. */
  documentLabel: string;
  /** false = só prepara (assina e registra), sem baixar. Usado na impressão. */
  download?: boolean;
  action?: 'DOWNLOAD' | 'PRINT';
}

export interface DeliverResult {
  blob: Blob;
  signed: boolean;
}

export async function signForDelivery(blob: Blob, ctx: DeliverContext): Promise<DeliverResult> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return { blob, signed: false };

  const a1 = await requestSigner(userId, ctx.documentLabel);
  if (!a1) return { blob, signed: false };
  try {
    const { signPdf } = await import('@/lib/signature/pades');
    const bytes = await signPdf(await blob.arrayBuffer(), a1, {
      reason: `${ctx.documentLabel} assinado pelo profissional responsável`,
      location: 'Brasil',
    });
    const signedBlob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    void logActivity({
      action: 'SIGN',
      entity: ctx.entity,
      entityId: ctx.entityId,
      content: signedBlob,
      details: {
        documento: ctx.documentLabel,
        certificado_titular: a1.info.nome,
        certificado_emissor: a1.info.emissor,
        certificado_serial: a1.info.serial,
        certificado_valido_ate: a1.info.validoAte,
        icp_brasil: a1.info.icpBrasil,
      },
    });
    return { blob: signedBlob, signed: true };
  } catch (e) {
    toast({
      title: 'Não foi possível assinar o PDF',
      description: (e as Error).message || 'O documento será entregue sem a assinatura digital.',
      variant: 'destructive',
    });
    return { blob, signed: false };
  }
}

export async function deliverPdf(blob: Blob, fileName: string, ctx: DeliverContext): Promise<DeliverResult> {
  const result = await signForDelivery(blob, ctx);
  if (ctx.download !== false) downloadPdf(result.blob, fileName);
  void logActivity({
    action: ctx.action || 'DOWNLOAD',
    entity: ctx.entity,
    entityId: ctx.entityId,
    content: result.blob,
    details: { documento: ctx.documentLabel, arquivo: fileName, assinado_digitalmente: result.signed },
  });
  return result;
}
