import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VideoRoom } from "@/components/telemedicina/VideoRoom";
import { ConsentTermoTelemedicina } from "@/components/telemedicina/ConsentTermoTelemedicina";
import { Activity, ShieldCheck, Video, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Teleconsulta } from "@/types/teleconsulta";

const PATIENT_SAFE_FIELDS =
  "id, patient_name, patient_email, room_url, patient_token, status, scheduled_at, chief_complaint, doctor_consent_at, patient_consent_at";

export default function SalaPaciente() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [tc, setTc] = useState<Teleconsulta | null>(null);
  const [loading, setLoading] = useState(true);
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const load = async () => {
    if (!id) return;
    if (!token) {
      setError("Link inválido. Solicite um novo ao seu médico.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_teleconsulta_for_patient" as any, {
      p_id: id,
      p_token: token,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      setError("Sala não encontrada, link inválido ou expirado.");
      setLoading(false);
      return;
    }
    const t = row as unknown as Teleconsulta;
    if (t.status === "concluida" || t.status === "cancelada") {
      setEnded(true);
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
  }, [id, token]);

  // Polling: anonymous patient cannot subscribe to private realtime channels,
  // so we poll the status every 4s to detect when the doctor ends the call.
  useEffect(() => {
    if (!id || !token) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc(
        "get_teleconsulta_status_for_patient" as any,
        { p_id: id, p_token: token }
      );
      const status = data as unknown as string | null;
      if (status === "concluida" || status === "cancelada") {
        setEnded(true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [id, token]);


  const handleConsent = async () => {
    if (!tc) return;
    await supabase.rpc("register_patient_consent" as any, {
      p_id: tc.id,
      p_consent_at: new Date().toISOString(),
    });
    setConsented(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (ended) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-10 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="flex items-center gap-2 justify-center text-primary">
              <Video className="w-5 h-5" />
              <span className="text-lg font-semibold">MindMed</span>
            </div>
            <h1 className="text-xl font-semibold">Consulta encerrada</h1>
            <p className="text-sm text-muted-foreground">
              Obrigado pelo atendimento. Em caso de dúvidas, entre em contato com seu médico.
            </p>
          </CardContent>
        </Card>
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
