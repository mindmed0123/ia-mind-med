import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Activity, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { invalidateAppCache } from "@/hooks/useAppState";

interface InvitePreview {
  email?: string;
  full_name?: string | null;
  organization_name?: string;
  invited_by_name?: string | null;
  role?: string;
  status?: string;
  expires_at?: string;
  error?: string;
}

export default function AceitarConvite() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_preview", { _token: token });
      if (error || !data) {
        setPreview({ error: "Convite não encontrado" });
      } else {
        setPreview(data as InvitePreview);
      }
      setLoading(false);
    })();
  }, [token]);

  async function handleAccept() {
    if (!token || !user) return;
    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-org-invite", {
        body: { token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      invalidateAppCache();
      setAccepted(true);
      toast.success("Convite aceito! Bem-vindo(a) à equipe!");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (e: any) {
      toast.error(e.message || "Erro ao aceitar convite");
    } finally {
      setAccepting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !preview || preview.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Convite inválido</h1>
            <p className="text-sm text-muted-foreground">
              Este convite não foi encontrado ou está incorreto. Peça um novo link ao administrador.
            </p>
            <Button asChild className="w-full">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (preview.status && preview.status !== "pending") {
    const statusText: Record<string, string> = {
      accepted: "Este convite já foi aceito anteriormente.",
      cancelled: "Este convite foi cancelado pelo administrador.",
      expired: "Este convite expirou. Peça um novo ao administrador.",
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">Convite indisponível</h1>
            <p className="text-sm text-muted-foreground">{statusText[preview.status]}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Voltar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Você foi convidado(a)</h1>
            <p className="text-sm text-muted-foreground">
              <strong>{preview.invited_by_name || "Um administrador"}</strong> te convidou para integrar a equipe de:
            </p>
            <p className="text-lg font-bold text-primary">{preview.organization_name}</p>
          </div>

          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="w-4 h-4" />
              Acesso PRO completo, por nossa conta
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6">
              <li>• Agenda médica profissional</li>
              <li>• Geração de laudos com IA</li>
              <li>• Receituário inteligente</li>
              <li>• Gestão de pacientes e prontuário</li>
            </ul>
          </div>

          {accepted ? (
            <div className="text-center text-emerald-600 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Redirecionando ao dashboard...</span>
            </div>
          ) : !user ? (
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">
                Convite enviado para <strong>{preview.email}</strong>. Faça login ou crie sua conta para aceitar.
              </p>
              <Button asChild className="w-full">
                <Link to={`/?next=${encodeURIComponent(`/aceitar-convite?token=${token}`)}`}>
                  Entrar / Criar conta
                </Link>
              </Button>
            </div>
          ) : user.email?.toLowerCase() !== preview.email?.toLowerCase() ? (
            <div className="space-y-2">
              <p className="text-xs text-center text-destructive">
                Você está logado como <strong>{user.email}</strong>, mas este convite foi enviado para{" "}
                <strong>{preview.email}</strong>.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate(`/?next=${encodeURIComponent(`/aceitar-convite?token=${token}`)}`);
                }}
              >
                Trocar de conta
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full"
              size="lg"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aceitando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Aceitar convite
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
