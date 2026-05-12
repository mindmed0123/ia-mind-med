import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Video, Copy, X, FileText, ExternalLink, Clock, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  TELECONSULTA_STATUS_COLOR,
  TELECONSULTA_STATUS_LABEL,
  type Teleconsulta,
} from "@/types/teleconsulta";

interface Props {
  teleconsulta: Teleconsulta;
  onCancel?: (id: string) => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function formatDuration(s: number | null) {
  if (!s) return "-";
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}min ${sec.toString().padStart(2, "0")}s`;
}

export function TeleconsultaCard({ teleconsulta: tc, onCancel }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const copyLink = async () => {
    const link = `${window.location.origin}/sala/${tc.id}${tc.patient_token ? `?t=${tc.patient_token}` : ""}`;
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copiado", description: "Cole no WhatsApp do paciente" });
  };

  return (
    <Card className="shadow-soft hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar className="w-10 h-10 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs">
                {initials(tc.patient_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{tc.patient_name}</h3>
              {tc.chief_complaint && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{tc.chief_complaint}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={TELECONSULTA_STATUS_COLOR[tc.status]}>
            {TELECONSULTA_STATUS_LABEL[tc.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
          {tc.scheduled_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(tc.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
          {tc.duration_seconds != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(tc.duration_seconds)}
            </span>
          )}
          {tc.patient_cpf && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {tc.patient_cpf}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(tc.status === "agendada" || tc.status === "sala_aberta") && (
            <>
              <Button
                size="sm"
                onClick={() => navigate(`/consulta/${tc.id}`)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                <Video className="w-4 h-4 mr-1" /> Abrir Sala
              </Button>
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="w-4 h-4 mr-1" /> Link
              </Button>
              {onCancel && (
                <Button size="sm" variant="ghost" onClick={() => onCancel(tc.id)} className="text-destructive hover:text-destructive">
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              )}
            </>
          )}
          {tc.status === "em_andamento" && (
            <Button
              size="sm"
              onClick={() => navigate(`/consulta/${tc.id}`)}
              className="bg-gradient-to-r from-green-500 to-emerald-600"
            >
              <Video className="w-4 h-4 mr-1" /> Entrar na Consulta
            </Button>
          )}
          {tc.status === "concluida" && (
            <>
              {tc.laudo_id && (
                <Button size="sm" variant="outline" onClick={() => navigate(`/novo-laudo?id=${tc.laudo_id}`)}>
                  <FileText className="w-4 h-4 mr-1" /> Ver Laudo
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => navigate(`/consulta/${tc.id}`)}>
                <ExternalLink className="w-4 h-4 mr-1" /> Detalhes
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
