import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OrgMember } from "@/hooks/useOrganization";
import { useUnavailability } from "@/hooks/useUnavailability";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, CalendarOff, Repeat } from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Props {
  organizationId: string;
  members: OrgMember[];
}

export function UnavailabilityTab({ organizationId, members }: Props) {
  const [reloadKey, setReloadKey] = useState(0);
  const { items, loading } = useUnavailability(organizationId, reloadKey);
  const doctorMembers = members.filter((m) => m.role === "owner" || m.role === "doctor");

  const [creating, setCreating] = useState(false);
  const [doctorId, setDoctorId] = useState(doctorMembers[0]?.user_id ?? "");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("23:59");
  const [recurring, setRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [recurrenceEnd, setRecurrenceEnd] = useState("");

  function toggleWeekday(w: number) {
    setWeekdays((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort()));
  }

  async function create() {
    if (!doctorId || !startDate || !endDate) {
      toast.error("Preencha médico e datas");
      return;
    }
    if (recurring && weekdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana para recorrência");
      return;
    }
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) {
      setCreating(false);
      return;
    }
    const startAt = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endAt = new Date(`${endDate}T${endTime}:00`).toISOString();
    const { error } = await supabase.from("doctor_unavailability").insert({
      organization_id: organizationId,
      doctor_id: doctorId,
      created_by: userId,
      start_at: startAt,
      end_at: endAt,
      title: title.trim() || null,
      reason: title.trim() || null,
      recurrence_pattern: recurring ? "weekly" : "none",
      recurrence_weekdays: recurring ? weekdays : null,
      recurrence_end_date: recurring && recurrenceEnd ? recurrenceEnd : null,
    } as any);
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bloqueio criado");
    setTitle("");
    setStartDate("");
    setEndDate("");
    setRecurring(false);
    setWeekdays([]);
    setRecurrenceEnd("");
    setReloadKey((k) => k + 1);
  }

  async function remove(id: string) {
    if (!confirm("Remover este bloqueio?")) return;
    await supabase.from("doctor_unavailability").delete().eq("id", id);
    setReloadKey((k) => k + 1);
  }

  function formatRange(item: any) {
    const s = new Date(item.start_at);
    const e = new Date(item.end_at);
    const fmt = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
      " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${fmt(s)} → ${fmt(e)}`;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Bloqueie horários ou dias inteiros para férias, congressos ou folgas. Os horários bloqueados não aparecem para agendamento online.
      </p>

      <Card className="bg-muted/30">
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Médico</Label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {doctorMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name ?? "Médico"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Título (ex: Férias, Congresso)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Início</Label>
              <div className="flex gap-1">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-28" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <div className="flex gap-1">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-28" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Switch checked={recurring} onCheckedChange={setRecurring} />
            <Label className="text-sm flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" />
              Repetir semanalmente
            </Label>
          </div>

          {recurring && (
            <div className="space-y-2 pl-2 border-l-2 border-primary/40">
              <div>
                <Label className="text-xs">Dias da semana</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {WEEKDAYS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => toggleWeekday(i)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        weekdays.includes(i)
                          ? "bg-primary text-primary-foreground border-transparent"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Repetir até (opcional)</Label>
                <Input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} />
              </div>
            </div>
          )}

          <Button onClick={create} disabled={creating} className="w-full sm:w-auto">
            {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Criar bloqueio
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarOff className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum bloqueio cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const member = members.find((m) => m.user_id === item.doctor_id);
            return (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.title ?? item.reason ?? "Bloqueio"}</span>
                      {item.recurrence_pattern === "weekly" && (
                        <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          <Repeat className="w-3 h-3 inline mr-1" />
                          {item.recurrence_weekdays?.map((w) => WEEKDAYS[w]).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span style={{ color: member?.display_color ?? undefined }}>● </span>
                      {member?.display_name ?? "Médico"} · {formatRange(item)}
                      {item.recurrence_end_date && ` · até ${new Date(item.recurrence_end_date).toLocaleDateString("pt-BR")}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(item.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
