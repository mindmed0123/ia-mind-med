import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, ShieldAlert } from "lucide-react";
import mindmedMark from "@/assets/mindmed-logo-mark.png";

type Resultado = {
  valid: boolean;
  status?: string;
  hash_match?: boolean;
  numero?: string;
  created_at?: string;
  finalized_at?: string | null;
  medico?: { nome: string; crm: string; especialidade: string; conselho?: string };
  error?: string;
};

const dataBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

/** Página pública aberta pelo QR do laudo em PDF. Não mostra dados do paciente. */
const VerificarLaudo = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => {
    document.title = "Verificar laudo · MindMed";
    if (!id || !token) {
      setRes({ valid: false, error: "Código de verificação incompleto." });
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pdf/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}&format=json`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => r.json())
      .then(setRes)
      .catch(() => setRes({ valid: false, error: "Não foi possível consultar agora. Tente novamente em instantes." }));
  }, [id, token]);

  const pendente = res && !res.valid && res.hash_match && res.status !== "completed";
  const psi = res?.medico?.conselho === "CRP";

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <img src={mindmedMark} alt="" className="w-9 h-9" />
          <span className="text-xl font-bold tracking-tight text-foreground">MindMed</span>
        </div>

        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
          <div className="p-6 sm:p-8">
            {!res ? (
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm">Verificando o documento…</p>
              </div>
            ) : res.valid ? (
              <>
                <div className="flex flex-col items-center text-center gap-2 mb-6">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                  <h1 className="text-xl font-bold text-foreground">{psi ? "Documento autêntico" : "Laudo autêntico"}</h1>
                  <p className="text-sm text-muted-foreground">
                    Este documento foi emitido pelo MindMed e não foi substituído por outra versão.
                  </p>
                </div>
                <dl className="divide-y divide-border rounded-xl border border-border text-sm">
                  {[
                    [psi ? "Psicólogo(a)" : "Médico(a)", res.medico?.nome],
                    [psi ? "CRP" : "CRM", res.medico?.crm],
                    ["Especialidade", res.medico?.especialidade],
                    ["Documento nº", res.numero],
                    [psi ? "Data da sessão" : "Data da consulta", dataBR(res.created_at)],
                    ["Concluído em", dataBR(res.finalized_at)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium text-foreground text-right">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <div className="flex flex-col items-center text-center gap-2 py-4">
                {pendente ? <Clock className="w-12 h-12 text-muted-foreground" /> : <ShieldAlert className="w-12 h-12 text-destructive" />}
                <h1 className="text-xl font-bold text-foreground">
                  {pendente ? "Laudo ainda não concluído" : "Não foi possível confirmar"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {pendente
                    ? "O médico ainda não concluiu este laudo. Peça a versão final ao seu médico."
                    : "Este código não corresponde à versão atual do laudo. Se você recebeu uma versão mais nova, use o código dela, ou fale com o seu médico."}
                </p>
              </div>
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center mt-5">
          Por privacidade, esta página não mostra dados do paciente.
        </p>
      </div>
    </main>
  );
};

export default VerificarLaudo;
