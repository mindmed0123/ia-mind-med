import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FileKey2, Loader2, ShieldCheck, Lock } from 'lucide-react';
import type { A1Certificate } from '@/lib/signature/pades';
import {
  getStoredCertificate,
  saveStoredCertificate,
  removeStoredCertificate,
  setUnlocked,
  type StoredCertificate,
} from '@/lib/signature/certificate-store';

interface CertificateFormProps {
  userId: string;
  submitLabel: string;
  onUnlocked: (a1: A1Certificate) => void;
  secondaryAction?: { label: string; onClick: () => void };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** Abre o certificado A1: pede só a senha quando o arquivo já está guardado neste computador. */
export function CertificateForm({ userId, submitLabel, onUnlocked, secondaryAction }: CertificateFormProps) {
  const [stored, setStored] = useState<StoredCertificate | null>(null);
  const [loadingStored, setLoadingStored] = useState(true);
  const [useOtherFile, setUseOtherFile] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getStoredCertificate(userId).then((s) => {
      if (!alive) return;
      setStored(s);
      setLoadingStored(false);
      setTimeout(() => passwordRef.current?.focus(), 50);
    });
    return () => { alive = false; };
  }, [userId]);

  const askFile = !stored || useOtherFile;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (askFile && !file) return setError('Escolha o arquivo do seu certificado (.pfx ou .p12).');
    if (!password) return setError('Digite a senha do certificado.');
    setBusy(true);
    try {
      const bytes = askFile ? await file!.arrayBuffer() : stored!.bytes;
      const { loadA1 } = await import('@/lib/signature/pades');
      const a1 = loadA1(bytes, password);
      if (askFile) {
        if (remember) {
          await saveStoredCertificate({ userId, fileName: file!.name, bytes, info: a1.info, savedAt: new Date().toISOString() });
        } else {
          await removeStoredCertificate(userId);
        }
      }
      setUnlocked(userId, a1);
      setPassword('');
      onUnlocked(a1);
    } catch (err) {
      setError((err as Error).message || 'Não foi possível abrir o certificado.');
    } finally {
      setBusy(false);
    }
  };

  if (loadingStored) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {stored && !useOtherFile ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium"><ShieldCheck className="w-4 h-4 text-primary" />{stored.info.nome}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {stored.info.emissor} · válido até {fmtDate(stored.info.validoAte)}
          </div>
          <button type="button" className="text-xs text-primary hover:underline mt-2" onClick={() => setUseOtherFile(true)}>
            Usar outro arquivo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="cert-file">Arquivo do certificado A1 (.pfx ou .p12)</Label>
          <label
            htmlFor="cert-file"
            className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            <FileKey2 className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm truncate">{file ? file.name : 'Escolher arquivo no computador'}</span>
          </label>
          <input
            id="cert-file"
            type="file"
            accept=".pfx,.p12,application/x-pkcs12"
            className="sr-only"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cert-password">Senha do certificado</Label>
        <Input
          id="cert-password"
          ref={passwordRef}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
        />
      </div>

      {askFile && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} className="mt-0.5" />
          <span>Lembrar o arquivo neste computador. A senha nunca é guardada: ela é pedida uma vez a cada vez que você abre o MindMed.</span>
        </label>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="w-3 h-3 mt-0.5 shrink-0" />
        O arquivo e a senha não saem do seu computador. A assinatura é feita aqui mesmo, no seu navegador.
      </p>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        {secondaryAction && (
          <Button type="button" variant="ghost" onClick={secondaryAction.onClick} disabled={busy}>
            {secondaryAction.label}
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
