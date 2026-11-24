import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PenLine } from 'lucide-react';
import { CertificateForm } from './CertificateForm';
import { registerSignRequestHandler, type SignRequest } from '@/lib/signature/certificate-store';
import { logActivity, notifyCopyRecorded, registerCopyNotifier, type ActivityEntity } from '@/lib/activity-log';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function contextFromPage(): { entity: ActivityEntity; entityId: string | null } {
  const p = window.location.pathname;
  const id = p.match(new RegExp(UUID, 'i'))?.[0] ?? new URLSearchParams(window.location.search).get('id');
  if (p.startsWith('/receituarios')) return { entity: 'PRESCRIPTION', entityId: null };
  if (p.startsWith('/historico-paciente') || p.startsWith('/pacientes')) return { entity: 'PATIENT', entityId: id };
  if (p.startsWith('/evolucao')) return { entity: 'PATIENT', entityId: id };
  if (p.startsWith('/novo-laudo') || p.startsWith('/consulta')) return { entity: 'REPORT', entityId: p.startsWith('/novo-laudo') ? id : null };
  return { entity: 'DOCUMENT', entityId: null };
}

/**
 * Montado uma vez no app para o médico logado:
 * - registra toda cópia de texto feita dentro do MindMed;
 * - abre a janela do certificado quando um PDF vai ser assinado.
 */
export function DocumentGuards() {
  const { user } = useAuth();
  const [request, setRequest] = useState<SignRequest | null>(null);

  useEffect(() => {
    if (!user) return;
    registerCopyNotifier(() =>
      toast('Cópia registrada em seu nome', {
        description: 'O conteúdo copiado fica sob sua responsabilidade profissional.',
        duration: 3500,
      })
    );

    const onCopy = () => {
      const sel = window.getSelection();
      let text = sel?.toString() ?? '';
      const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      if (!text && active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
        if ((active as HTMLInputElement).type === 'password') return;
        const { selectionStart, selectionEnd } = active;
        if (selectionStart != null && selectionEnd != null) text = active.value.slice(selectionStart, selectionEnd);
      }
      if (text.trim().length < 3) return;
      const anchor = sel?.anchorNode;
      const el = (anchor instanceof Element ? anchor : anchor?.parentElement) || active;
      const marked = el?.closest?.('[data-audit-entity]') as HTMLElement | null;
      const fallback = contextFromPage();
      const entity = (marked?.dataset.auditEntity as ActivityEntity) || fallback.entity;
      const entityId = marked?.dataset.auditId || fallback.entityId;
      notifyCopyRecorded();
      void logActivity({
        action: 'COPY',
        entity,
        entityId,
        content: text,
        details: { origem: 'selecao', caracteres: text.length },
      });
    };
    document.addEventListener('copy', onCopy);
    registerSignRequestHandler((r) => setRequest(r));
    return () => {
      document.removeEventListener('copy', onCopy);
      registerSignRequestHandler(null);
      registerCopyNotifier(null);
    };
  }, [user]);

  const finish = (value: Parameters<SignRequest['resolve']>[0]) => {
    request?.resolve(value);
    setRequest(null);
  };

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) finish(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            Assinar {request?.documentLabel.toLowerCase()} com seu certificado
          </DialogTitle>
          <DialogDescription>
            O PDF sai assinado digitalmente com seu certificado ICP-Brasil, com validade jurídica.
          </DialogDescription>
        </DialogHeader>
        {request && (
          <CertificateForm
            userId={request.userId}
            submitLabel="Assinar e baixar"
            onUnlocked={(a1) => finish(a1)}
            secondaryAction={{ label: 'Baixar sem assinatura digital', onClick: () => finish(null) }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
