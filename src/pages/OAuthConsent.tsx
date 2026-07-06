import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Activity, ShieldCheck } from "lucide-react";

// Beta API not yet in typings — narrow wrapper.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

function safeNext(): string {
  const path = window.location.pathname + window.location.search;
  if (!path.startsWith("/")) return "/";
  return path;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Parâmetro authorization_id ausente");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = "/?next=" + encodeURIComponent(safeNext());
        return;
      }
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Falha ao carregar a solicitação");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const api = oauth();
      const { data, error } = approve
        ? await api.approveAuthorization(authorizationId)
        : await api.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        return setError(error.message);
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        return setError("Servidor de autorização não retornou redirect.");
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Falha ao processar decisão");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <h1 className="text-xl font-semibold">Não foi possível autorizar</h1>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando autorização…</p>
        </div>
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "um aplicativo externo";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-6 h-6" />
            <span className="text-sm font-medium">Autorização MindMed</span>
          </div>
          <h1 className="text-2xl font-semibold">
            Conectar {clientName} à sua conta
          </h1>
          <p className="text-sm text-muted-foreground">
            Este aplicativo poderá acessar seus pacientes, laudos e catálogo de medicamentos
            no MindMed, agindo em seu nome. Você pode revogar o acesso a qualquer momento.
          </p>
        </CardHeader>
        <CardContent className="flex gap-2 justify-end">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Recusar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Processando…" : "Autorizar"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
