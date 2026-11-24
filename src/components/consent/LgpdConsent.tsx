import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sha256Hex } from "@/lib/activity-log";
import {
  TERMO_ITENS, TERMO_SECOES, TERMO_VERSAO, nomeCompletoValido, termoTextoCanonico,
} from "@/lib/termo-adesao";

interface LgpdConsentProps {
  userId: string;
  onConsentGiven?: () => void;
  forceOpen?: boolean;
}

/** Termo de adesão: o médico marca cada item e assina digitando o nome completo. */
export const LgpdConsent = ({ userId, onConsentGiven }: LgpdConsentProps) => {
  const { toast } = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [nome, setNome] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allChecked = useMemo(() => TERMO_ITENS.every((i) => checked[i.id]), [checked]);
  const nomeOk = nomeCompletoValido(nome);

  const handleSubmit = async () => {
    if (!allChecked || !nomeOk) return;
    setSubmitting(true);
    try {
      const textHash = await sha256Hex(termoTextoCanonico());
      const { error } = await supabase.rpc("accept_terms", {
        p_version: TERMO_VERSAO,
        p_text_sha256: textHash,
        p_full_name: nome.trim(),
        p_items: TERMO_ITENS.map((i) => i.id) as never,
      });
      if (error) throw error;
      localStorage.setItem(`lgpd_consent_${userId}`, JSON.stringify({ version: TERMO_VERSAO, date: new Date().toISOString() }));
      toast({ title: "Termo assinado", description: "Seu aceite foi registrado com data, hora e assinatura." });
      onConsentGiven?.();
    } catch {
      toast({ title: "Não foi possível registrar", description: "Confira sua conexão e tente de novo.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col gap-4 p-4 sm:p-6" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileSignature className="w-6 h-6 text-primary shrink-0" />
            Termo de adesão e responsabilidade profissional
          </DialogTitle>
          <DialogDescription>
            Leia, marque cada item e assine com seu nome completo para usar o MindMed. Versão {TERMO_VERSAO.split("-").reverse().join("/")}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            {TERMO_SECOES.map((s) => (
              <section key={s.titulo} className="space-y-1.5">
                <h3 className="font-semibold text-foreground">{s.titulo}</h3>
                {s.texto.map((t, i) => (
                  <p key={i} className="text-muted-foreground leading-relaxed">{t}</p>
                ))}
              </section>
            ))}
            <p className="text-xs text-muted-foreground">
              Texto completo: <Link to="/termos" target="_blank" className="text-primary underline">Termos de Uso</Link> e{" "}
              <Link to="/privacidade" target="_blank" className="text-primary underline">Política de Privacidade</Link>.
              Encarregado de dados: contato@mindmed.com.br
            </p>
          </div>

          <div className="space-y-3">
            {TERMO_ITENS.map((item) => (
              <label key={item.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/40 cursor-pointer">
                <Checkbox
                  checked={!!checked[item.id]}
                  onCheckedChange={(v) => setChecked((c) => ({ ...c, [item.id]: v === true }))}
                  className="mt-0.5"
                  aria-label={item.texto}
                />
                <span className="text-sm leading-snug">{item.texto}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assinatura-nome">Assinatura: digite seu nome completo</Label>
            <Input
              id="assinatura-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome e sobrenome"
              autoComplete="name"
            />
            <p className="text-xs text-muted-foreground">
              Ao assinar, registramos data, hora, endereço de internet e a impressão digital deste texto.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!allChecked || !nomeOk || submitting} className="w-full sm:w-auto">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitting ? "Registrando..." : "Assinar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
