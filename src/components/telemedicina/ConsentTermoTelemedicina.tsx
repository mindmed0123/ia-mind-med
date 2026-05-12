import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Activity, ShieldCheck } from "lucide-react";

interface Props {
  patientName: string;
  doctorName?: string;
  onAccept: () => void;
  loading?: boolean;
}

export function ConsentTermoTelemedicina({ patientName, doctorName, onAccept, loading }: Props) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 32) setScrolledToEnd(true);
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-large max-w-2xl w-full overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-5 flex items-center gap-3">
          <Activity className="w-7 h-7" />
          <div>
            <h1 className="text-xl font-bold">MindMed Teleconsulta</h1>
            <p className="text-xs opacity-90">Termo de Consentimento — CFM 2.314/2022</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Olá, <strong className="text-foreground">{patientName}</strong></p>
            {doctorName && <p className="text-muted-foreground mt-1">Consulta com <strong className="text-foreground">{doctorName}</strong></p>}
          </div>

          <ScrollArea ref={scrollRef} className="h-72 border rounded-lg p-4 bg-slate-50">
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <p>Eu, <strong>{patientName}</strong>, declaro que:</p>
              <ol className="space-y-3 pl-4 list-decimal">
                <li>Fui informado(a) que esta consulta será realizada por meio de tecnologia de telecomunicação (telemedicina), conforme autorizado pela <strong>Lei Federal nº 14.510/2022</strong> e <strong>Resolução CFM nº 2.314/2022</strong>.</li>
                <li>Compreendo que meus dados pessoais e de saúde serão tratados conforme a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>, com confidencialidade médica garantida.</li>
                <li>Autorizo o uso de câmera e microfone do meu dispositivo para realização desta consulta médica.</li>
                <li>Estou ciente de que o médico poderá encaminhar-me para consulta presencial caso julgue clinicamente necessário.</li>
                <li>Concordo com os <strong>Termos de Uso</strong> e <strong>Política de Privacidade</strong> da plataforma MindMed.</li>
                <li>Esta sessão é <strong>privada e confidencial</strong>. Não autorizo gravações por terceiros.</li>
                <li>Estou em local com privacidade adequada para a consulta médica.</li>
              </ol>
              <p className="pt-2 text-xs text-muted-foreground border-t mt-4 pt-3">
                A MindMed apenas hospeda esta sessão. A responsabilidade técnica e ética pelo atendimento é exclusiva do médico responsável, devidamente registrado no CRM.
              </p>
            </div>
          </ScrollArea>

          {!scrolledToEnd && (
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Role até o fim para confirmar a leitura.
            </p>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(!!v)}
              disabled={!scrolledToEnd}
              className="mt-0.5"
            />
            <span className="text-sm">Li e concordo com os termos acima</span>
          </label>

          <Button
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
            disabled={!accepted || loading}
            onClick={onAccept}
          >
            Aceitar e entrar na consulta
          </Button>
        </div>
      </div>
    </div>
  );
}
