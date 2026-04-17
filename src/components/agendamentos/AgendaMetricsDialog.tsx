import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgendaMetrics } from "@/hooks/useAgendaMetrics";
import { OrgMember } from "@/hooks/useOrganization";
import {
  BarChart3, TrendingUp, Calendar, CheckCircle2, XCircle, UserX, Clock, Activity, Users,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  members: OrgMember[];
}

type Range = "7d" | "30d" | "90d" | "month";

export function AgendaMetricsDialog({ open, onOpenChange, organizationId, members }: Props) {
  const [range, setRange] = useState<Range>("30d");
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const { start, end } = useMemo(() => {
    const now = new Date();
    const e = new Date(now);
    e.setHours(23, 59, 59, 999);
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    if (range === "7d") s.setDate(s.getDate() - 7);
    else if (range === "30d") s.setDate(s.getDate() - 30);
    else if (range === "90d") s.setDate(s.getDate() - 90);
    else if (range === "month") {
      s.setDate(1);
    }
    return { start: s, end: e };
  }, [range]);

  const { metrics, loading } = useAgendaMetrics({
    organizationId,
    start,
    end,
    doctorId,
  });

  const doctorOptions = members.filter((m) => m.role === "owner" || m.role === "doctor");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Métricas da agenda
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(["7d", "30d", "90d", "month"] as Range[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "ghost"}
                onClick={() => setRange(r)}
                className="h-7 px-3 text-xs"
              >
                {r === "7d" ? "7 dias" : r === "30d" ? "30 dias" : r === "90d" ? "90 dias" : "Este mês"}
              </Button>
            ))}
          </div>
          {doctorOptions.length > 1 && (
            <select
              value={doctorId ?? "all"}
              onChange={(e) => setDoctorId(e.target.value === "all" ? null : e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">Todos os médicos</option>
              {doctorOptions.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name ?? "Médico"}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading || !metrics ? (
          <div className="grid md:grid-cols-4 gap-3 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-3">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi
                icon={Calendar}
                label="Total de agendamentos"
                value={metrics.total}
                color="text-primary"
                bg="bg-primary/10"
              />
              <Kpi
                icon={CheckCircle2}
                label="Concluídos"
                value={metrics.completed}
                hint={`${metrics.completion_rate}% de conclusão`}
                color="text-emerald-600"
                bg="bg-emerald-100"
              />
              <Kpi
                icon={UserX}
                label="No-show"
                value={metrics.no_show}
                hint={`${metrics.no_show_rate}% de faltas`}
                color="text-destructive"
                bg="bg-destructive/10"
              />
              <Kpi
                icon={TrendingUp}
                label="Taxa de ocupação"
                value={`${metrics.occupancy_rate}%`}
                hint={`${Math.round(metrics.total_minutes / 60)}h agendadas`}
                color="text-amber-600"
                bg="bg-amber-100"
              />
            </div>

            {/* Status breakdown */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  Status dos agendamentos
                </h3>
                <StatusBars total={metrics.total} byStatus={metrics.by_status} />
              </CardContent>
            </Card>

            {/* By doctor */}
            {metrics.by_doctor.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Por médico
                  </h3>
                  <div className="space-y-2">
                    {metrics.by_doctor.map((d) => (
                      <DoctorRow key={d.doctor_id} doctor={d} maxTotal={metrics.by_doctor[0].total} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* By type */}
            {metrics.by_type.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Por tipo de atendimento
                  </h3>
                  <div className="space-y-2">
                    {metrics.by_type.map((t, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-sm truncate">{t.type_name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="text-muted-foreground">{t.completed} concluídos</span>
                          {t.no_show > 0 && (
                            <span className="text-destructive">{t.no_show} faltas</span>
                          )}
                          <span className="font-semibold tabular-nums">{t.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {metrics.total === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum agendamento neste período.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Kpi({
  icon: Icon, label, value, hint, color, bg,
}: { icon: any; label: string; value: number | string; hint?: string; color: string; bg: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${color}`} />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBars({ total, byStatus }: { total: number; byStatus: Record<string, number> }) {
  const items: Array<{ key: string; label: string; color: string }> = [
    { key: "completed", label: "Concluídos", color: "bg-emerald-500" },
    { key: "scheduled", label: "Agendados", color: "bg-primary" },
    { key: "confirmed", label: "Confirmados", color: "bg-cyan-500" },
    { key: "in_progress", label: "Em atendimento", color: "bg-amber-500" },
    { key: "cancelled", label: "Cancelados", color: "bg-muted-foreground/40" },
    { key: "no_show", label: "Faltas", color: "bg-destructive" },
  ];
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const v = byStatus[it.key] ?? 0;
        const pct = total > 0 ? (v / total) * 100 : 0;
        return (
          <div key={it.key} className="flex items-center gap-2">
            <div className="w-32 text-xs text-muted-foreground shrink-0">{it.label}</div>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${it.color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <div className="w-12 text-right text-xs font-medium tabular-nums">{v}</div>
          </div>
        );
      })}
    </div>
  );
}

function DoctorRow({
  doctor,
  maxTotal,
}: {
  doctor: { doctor_id: string; doctor_name: string; color: string; total: number; completed: number; no_show: number; cancelled: number };
  maxTotal: number;
}) {
  const pct = maxTotal > 0 ? (doctor.total / maxTotal) * 100 : 0;
  const noShowPct = doctor.total > 0 ? Math.round((doctor.no_show / doctor.total) * 100) : 0;
  return (
    <div className="space-y-1.5 py-1.5 border-b border-border last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: doctor.color }} />
          <span className="text-sm truncate font-medium">{doctor.doctor_name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-emerald-600">{doctor.completed} ✓</span>
          {doctor.no_show > 0 && <span className="text-destructive">{noShowPct}% faltas</span>}
          <span className="font-semibold tabular-nums">{doctor.total}</span>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: doctor.color }} />
      </div>
    </div>
  );
}
