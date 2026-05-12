import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VideoRoom } from "@/components/telemedicina/VideoRoom";
import { ConsentTermoTelemedicina } from "@/components/telemedicina/ConsentTermoTelemedicina";
import { Activity, ShieldCheck, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Teleconsulta } from "@/types/teleconsulta";

export default function SalaPaciente() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [tc, setTc] = useState<Teleconsulta | null>(null);
  const [loading, setLoading] = useState(true);
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("teleconsultas" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      setError("Sala não encontrada ou expirada.");
      setLoading(false);
      return;
    }
    const t = data as unknown as Teleconsulta;
    if (token && t.patient_token && token !== t.patient_token) {
      setError("Link inválido. Solicite um novo ao seu médico.");
      setLoading(false);
      return;
    }
    if (t.status === "concluida" || t.status === "cancelada") {
      setError("Esta consulta já foi encerrada.");
      setLoading(false);
      return;
    }
    setTc(t);
    setConsented(!!t.patient_consent_at);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleConsent = async () => {
    if (!tc) return;
    await supabase
      .from("teleconsultas" as any)
      .update({ patient_consent_at: new Date().toISOString() })
      .eq("id", tc.id);
    setConsented(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-semibold">Acesso indisponível</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tc) return null;

  if (!consented) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full space-y-4">
          <div className="flex items-center gap-2 justify-center text-primary">
            <Video className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Sala de Telemedicina MindMed</h1>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-4">
                Olá, <strong>{tc.patient_name}</strong>. Antes de entrar na sala com seu médico,
                leia e aceite o termo de consentimento abaixo.
              </p>
              <ConsentTermoTelemedicina patientName={tc.patient_name} onAccept={handleConsent} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VideoRoom teleconsulta={tc} role="patient" />
    </div>
  );
}
