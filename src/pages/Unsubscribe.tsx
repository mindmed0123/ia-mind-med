import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus("invalid");
        } else if (data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };

    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
              <p className="text-muted-foreground">Verificando...</p>
            </>
          )}

          {status === "valid" && (
            <>
              <MailX className="w-12 h-12 text-primary mx-auto" />
              <h1 className="text-xl font-bold">Cancelar inscrição</h1>
              <p className="text-muted-foreground text-sm">
                Você não receberá mais emails de lembrete da MindMed.
              </p>
              <Button
                onClick={handleUnsubscribe}
                disabled={processing}
                className="w-full"
                variant="destructive"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Confirmar cancelamento
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <h1 className="text-xl font-bold">Inscrição cancelada</h1>
              <p className="text-muted-foreground text-sm">
                Você não receberá mais emails de lembrete.
              </p>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto" />
              <h1 className="text-xl font-bold">Já cancelado</h1>
              <p className="text-muted-foreground text-sm">
                Sua inscrição já foi cancelada anteriormente.
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Link inválido</h1>
              <p className="text-muted-foreground text-sm">
                Este link de cancelamento é inválido ou expirou.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Erro</h1>
              <p className="text-muted-foreground text-sm">
                Ocorreu um erro ao processar sua solicitação. Tente novamente.
              </p>
              <Button onClick={handleUnsubscribe} variant="outline" className="w-full">
                Tentar novamente
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
