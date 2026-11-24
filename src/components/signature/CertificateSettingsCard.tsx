import { useEffect, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileKey2, ShieldCheck, Trash2 } from 'lucide-react';
import { CertificateForm } from './CertificateForm';
import {
  getStoredCertificate, getUnlocked, removeStoredCertificate, setUnlocked, subscribeCertificate,
  type StoredCertificate,
} from '@/lib/signature/certificate-store';
import type { CertificateInfo } from '@/lib/signature/pades';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** Configuração do certificado digital A1 no Perfil. */
export function CertificateSettingsCard({ userId }: { userId: string }) {
  const [stored, setStored] = useState<StoredCertificate | null>(null);
  const [open, setOpen] = useState(false);
  const unlocked = useSyncExternalStore(subscribeCertificate, () => getUnlocked(userId));

  const refresh = () => getStoredCertificate(userId).then(setStored);
  useEffect(() => { void refresh(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const info: CertificateInfo | null = unlocked?.info ?? stored?.info ?? null;

  const remove = async () => {
    await removeStoredCertificate(userId);
    setUnlocked(userId, null);
    await refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileKey2 className="w-5 h-5" />
          Certificado digital (A1 ICP-Brasil)
        </CardTitle>
        <CardDescription>
          Laudos e receitas baixados saem assinados digitalmente com o seu certificado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {info ? (
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium flex-wrap">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {info.nome}
              <Badge variant={unlocked ? 'default' : 'secondary'}>
                {unlocked ? 'Pronto para assinar' : 'Pede a senha no próximo download'}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Emitido por {info.emissor} · válido até {fmt(info.validoAte)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum certificado configurado neste computador. Sem ele, os PDFs saem sem assinatura digital.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={info ? 'outline' : 'default'} onClick={() => setOpen(true)}>
            {info ? (unlocked ? 'Trocar certificado' : 'Abrir certificado agora') : 'Configurar certificado'}
          </Button>
          {(stored || unlocked) && (
            <Button type="button" variant="ghost" onClick={() => void remove()}>
              <Trash2 className="w-4 h-4 mr-2" /> Remover deste computador
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Certificado digital A1</DialogTitle>
            <DialogDescription>Escolha o arquivo .pfx ou .p12 do seu certificado ICP-Brasil e digite a senha.</DialogDescription>
          </DialogHeader>
          <CertificateForm
            userId={userId}
            submitLabel="Salvar certificado"
            onUnlocked={() => { setOpen(false); void refresh(); }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
