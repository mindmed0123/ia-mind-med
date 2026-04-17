import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useAppointments, useAppointmentTypes, Appointment } from "@/hooks/useAppointments";
import { AgendamentosGate } from "@/components/agendamentos/AgendamentosGate";
import { DayView } from "@/components/agendamentos/DayView";
import { WeekView } from "@/components/agendamentos/WeekView";
import { MonthView } from "@/components/agendamentos/MonthView";
import { AppointmentModal } from "@/components/agendamentos/AppointmentModal";
import { AgendaSettingsDialog } from "@/components/agendamentos/AgendaSettingsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Settings,
} from "lucide-react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(d.getDate() - d.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatRange(view: ViewMode, ref: Date): string {
  if (view === "day") {
    return ref.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }
  if (view === "week") {
    const ws = startOfWeek(ref);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    return `${ws.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${we.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function Agendamentos() {
  return (
    <AgendamentosGate>
      <AgendamentosContent />
    </AgendamentosGate>
  );
}

function AgendamentosContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, members, loading: orgLoading } = useOrganization();
  const [typesReloadKey, setTypesReloadKey] = useState(0);
  const { types } = useAppointmentTypes(organization?.id ?? null, typesReloadKey);

  const [view, setView] = useState<ViewMode>("week");
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [initialStart, setInitialStart] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typesReloadKey, setTypesReloadKey] = useState(0);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "day") {
      const s = new Date(refDate); s.setHours(0, 0, 0, 0);
      const e = new Date(refDate); e.setHours(23, 59, 59, 999);
      return { rangeStart: s, rangeEnd: e };
    }
    if (view === "week") {
      const s = startOfWeek(refDate);
      const e = new Date(s); e.setDate(s.getDate() + 7);
      return { rangeStart: s, rangeEnd: e };
    }
    const s = startOfMonth(refDate);
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
    return { rangeStart: s, rangeEnd: e };
  }, [view, refDate]);

  const { appointments, loading: apptsLoading, reload } = useAppointments({
    organizationId: organization?.id ?? null,
    rangeStart,
    rangeEnd,
    doctorIds: selectedDoctors.length > 0 ? selectedDoctors : undefined,
  });

  // Métricas do range
  const stats = useMemo(() => {
    let total = 0, completed = 0, cancelled = 0, noShow = 0;
    appointments.forEach((a) => {
      total++;
      if (a.status === "completed") completed++;
      else if (a.status === "cancelled") cancelled++;
      else if (a.status === "no_show") noShow++;
    });
    return { total, completed, cancelled, noShow };
  }, [appointments]);

  function navigateDate(direction: -1 | 0 | 1) {
    if (direction === 0) { setRefDate(new Date()); return; }
    const d = new Date(refDate);
    if (view === "day") d.setDate(d.getDate() + direction);
    else if (view === "week") d.setDate(d.getDate() + 7 * direction);
    else d.setMonth(d.getMonth() + direction);
    setRefDate(d);
  }

  function openCreate(start?: Date) {
    setEditingAppt(null);
    setInitialStart(start ?? null);
    setModalOpen(true);
  }

  function openEdit(appt: Appointment) {
    setEditingAppt(appt);
    setInitialStart(null);
    setModalOpen(true);
  }

  function toggleDoctor(uid: string) {
    setSelectedDoctors((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  }

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Organização não encontrada. Entre em contato com o suporte.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard
            </Button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <CalendarIcon className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight">Agendamentos</h1>
                <p className="text-[11px] text-muted-foreground leading-tight">{organization.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Configurações</span>
            </Button>
            <Button onClick={() => openCreate()} className="bg-gradient-to-r from-primary to-accent">
              <Plus className="w-4 h-4 mr-1.5" /> Novo agendamento
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={CalendarIcon} label="Total" value={stats.total} color="text-primary" />
          <StatCard icon={CheckCircle2} label="Concluídos" value={stats.completed} color="text-emerald-600" />
          <StatCard icon={XCircle} label="Cancelados" value={stats.cancelled} color="text-muted-foreground" />
          <StatCard icon={Clock} label="Faltas" value={stats.noShow} color="text-red-600" />
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate(0)}>
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="font-semibold text-sm sm:text-base capitalize px-2">
              {formatRange(view, refDate)}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {members.length > 1 && (
                <div className="hidden md:flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  {members.map((m) => {
                    const active = selectedDoctors.length === 0 || selectedDoctors.includes(m.user_id);
                    return (
                      <button
                        key={m.user_id}
                        onClick={() => toggleDoctor(m.user_id)}
                        className={cn(
                          "text-[11px] px-2 py-1 rounded-full border transition-all",
                          active
                            ? "border-transparent text-white shadow-sm"
                            : "border-border text-muted-foreground bg-transparent"
                        )}
                        style={active ? { backgroundColor: m.display_color ?? "hsl(var(--primary))" } : {}}
                      >
                        {m.display_name ?? "Médico"}
                      </button>
                    );
                  })}
                </div>
              )}

              <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
                <TabsList className="h-9">
                  <TabsTrigger value="day" className="text-xs">Dia</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs">Semana</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs">Mês</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <div className="relative">
          {apptsLoading && (
            <div className="absolute top-3 right-3 z-10 bg-card/80 backdrop-blur rounded-full px-3 py-1.5 text-xs flex items-center gap-2 border border-border shadow-sm">
              <Activity className="w-3 h-3 animate-spin text-primary" /> Carregando…
            </div>
          )}

          {view === "day" && (
            <DayView
              date={refDate}
              appointments={appointments}
              members={members}
              onSlotClick={openCreate}
              onAppointmentClick={openEdit}
            />
          )}
          {view === "week" && (
            <WeekView
              weekStart={startOfWeek(refDate)}
              appointments={appointments}
              members={members}
              onSlotClick={openCreate}
              onAppointmentClick={openEdit}
            />
          )}
          {view === "month" && (
            <MonthView
              monthStart={startOfMonth(refDate)}
              appointments={appointments}
              members={members}
              onDayClick={(d) => { setRefDate(d); setView("day"); }}
            />
          )}
        </div>
      </main>

      <AppointmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        organizationId={organization.id}
        members={members}
        types={types}
        initialStart={initialStart}
        appointment={editingAppt}
        onSaved={reload}
      />

      <AgendaSettingsDialog
        key={typesReloadKey}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        organizationId={organization.id}
        members={members}
        initialTypes={types}
        onChanged={() => setTypesReloadKey((k) => k + 1)}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg bg-muted flex items-center justify-center", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold leading-none mt-0.5">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
