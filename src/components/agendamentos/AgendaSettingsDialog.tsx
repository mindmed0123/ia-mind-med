import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { OrgMember } from "@/hooks/useOrganization";
import { AppointmentType } from "@/hooks/useAppointments";
import { UnavailabilityTab } from "./UnavailabilityTab";
import { TeamTab } from "./TeamTab";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Copy, ExternalLink, Link2, Clock,
  CalendarRange, ToggleLeft, Palette, CalendarOff, Users,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  ownerUserId: string;
  currentUserId: string;
  members: OrgMember[];
  initialTypes: AppointmentType[];
  onChanged: () => void;
}

interface Availability {
  id?: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface BookingLink {
  id: string;
  label: string;
  token: string;
  doctor_id: string | null;
  is_active: boolean;
  created_at: string;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export function AgendaSettingsDialog({
  open, onOpenChange, organizationId, members, initialTypes, onChanged,
}: Props) {
  const [tab, setTab] = useState("types");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            Configurações da agenda
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="types"><Palette className="w-3.5 h-3.5 mr-1.5" />Tipos</TabsTrigger>
            <TabsTrigger value="availability"><Clock className="w-3.5 h-3.5 mr-1.5" />Horários</TabsTrigger>
            <TabsTrigger value="blocks"><CalendarOff className="w-3.5 h-3.5 mr-1.5" />Bloqueios</TabsTrigger>
            <TabsTrigger value="links"><Link2 className="w-3.5 h-3.5 mr-1.5" />Links</TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="mt-4">
            <TypesTab organizationId={organizationId} initialTypes={initialTypes} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="availability" className="mt-4">
            <AvailabilityTab organizationId={organizationId} members={members} />
          </TabsContent>
          <TabsContent value="blocks" className="mt-4">
            <UnavailabilityTab organizationId={organizationId} members={members} />
          </TabsContent>
          <TabsContent value="links" className="mt-4">
            <BookingLinksTab organizationId={organizationId} members={members} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- TYPES TAB ---------------- */
function TypesTab({ organizationId, initialTypes, onChanged }: {
  organizationId: string; initialTypes: AppointmentType[]; onChanged: () => void;
}) {
  const [types, setTypes] = useState<AppointmentType[]>(initialTypes);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTypes(initialTypes); }, [initialTypes]);

  async function reload() {
    const { data } = await supabase
      .from("appointment_types")
      .select("*")
      .eq("organization_id", organizationId)
      .order("display_order");
    if (data) setTypes(data as AppointmentType[]);
    onChanged();
  }

  async function addType() {
    setSaving(true);
    const { error } = await supabase.from("appointment_types").insert({
      organization_id: organizationId,
      name: "Novo tipo",
      duration_minutes: 30,
      color: PRESET_COLORS[types.length % PRESET_COLORS.length],
      display_order: types.length,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    reload();
  }

  async function updateType(id: string, patch: Partial<AppointmentType>) {
    const { error } = await supabase.from("appointment_types").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else reload();
  }

  async function deleteType(id: string) {
    if (!confirm("Desativar este tipo de atendimento?")) return;
    const { error } = await supabase.from("appointment_types")
      .update({ is_active: false }).eq("id", id);
    if (error) toast.error(error.message);
    else reload();
  }

  const visible = types.filter((t) => t.is_active);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Defina os tipos de atendimento, sua duração padrão e cor na agenda.
      </p>
      {visible.map((t) => (
        <Card key={t.id}>
          <CardContent className="p-3 flex items-center gap-2">
            <input
              type="color"
              value={t.color}
              onChange={(e) => updateType(t.id, { color: e.target.value })}
              className="w-9 h-9 rounded cursor-pointer border border-border"
              aria-label="Cor"
            />
            <Input
              defaultValue={t.name}
              onBlur={(e) => e.target.value !== t.name && updateType(t.id, { name: e.target.value })}
              className="flex-1"
            />
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={5} step={5}
                defaultValue={t.duration_minutes}
                onBlur={(e) => {
                  const v = parseInt(e.target.value);
                  if (v >= 5 && v !== t.duration_minutes) updateType(t.id, { duration_minutes: v });
                }}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteType(t.id)}
              className="text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={addType} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
        Adicionar tipo
      </Button>
    </div>
  );
}

/* ---------------- AVAILABILITY TAB ---------------- */
function AvailabilityTab({ organizationId, members }: { organizationId: string; members: OrgMember[] }) {
  const doctorMembers = members.filter((m) => m.role === "owner" || m.role === "doctor");
  const [doctorId, setDoctorId] = useState(doctorMembers[0]?.user_id ?? "");
  const [rows, setRows] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("doctor_availability")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("doctor_id", doctorId);
      const map = new Map<number, Availability>();
      (data ?? []).forEach((r: any) => map.set(r.weekday, {
        id: r.id, doctor_id: r.doctor_id, weekday: r.weekday,
        start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5),
        is_active: r.is_active,
      }));
      const full: Availability[] = WEEKDAYS.map((_, w) =>
        map.get(w) ?? { doctor_id: doctorId, weekday: w, start_time: "08:00", end_time: "18:00", is_active: false },
      );
      setRows(full);
      setLoading(false);
    })();
  }, [doctorId, organizationId]);

  async function persistRow(r: Availability) {
    if (r.id) {
      await supabase.from("doctor_availability").update({
        start_time: r.start_time, end_time: r.end_time, is_active: r.is_active,
      }).eq("id", r.id);
    } else if (r.is_active) {
      const { data } = await supabase.from("doctor_availability").insert({
        organization_id: organizationId,
        doctor_id: doctorId,
        weekday: r.weekday,
        start_time: r.start_time,
        end_time: r.end_time,
        is_active: true,
      }).select("id").single();
      if (data) {
        setRows((prev) => prev.map((x) => x.weekday === r.weekday ? { ...r, id: data.id } : x));
      }
    }
  }

  function update(weekday: number, patch: Partial<Availability>) {
    setRows((prev) => {
      const next = prev.map((r) => r.weekday === weekday ? { ...r, ...patch } : r);
      const updated = next.find((r) => r.weekday === weekday)!;
      persistRow(updated);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {doctorMembers.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {doctorMembers.map((m) => (
            <button
              key={m.user_id}
              onClick={() => setDoctorId(m.user_id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                doctorId === m.user_id
                  ? "border-transparent text-white shadow-sm"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              style={doctorId === m.user_id ? { backgroundColor: m.display_color ?? "#3b82f6" } : {}}
            >
              {m.display_name ?? "Médico"}
            </button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Configure os dias da semana e horários em que este médico atende. Apenas estes horários serão oferecidos no agendamento online.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.weekday} className={r.is_active ? "" : "opacity-60"}>
              <CardContent className="p-3 flex items-center gap-3">
                <Switch checked={r.is_active} onCheckedChange={(v) => update(r.weekday, { is_active: v })} />
                <div className="w-12 font-medium text-sm">{WEEKDAYS[r.weekday]}</div>
                <Input
                  type="time"
                  value={r.start_time}
                  onChange={(e) => update(r.weekday, { start_time: e.target.value })}
                  disabled={!r.is_active}
                  className="w-32"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={r.end_time}
                  onChange={(e) => update(r.weekday, { end_time: e.target.value })}
                  disabled={!r.is_active}
                  className="w-32"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- BOOKING LINKS TAB ---------------- */
function BookingLinksTab({ organizationId, members }: { organizationId: string; members: OrgMember[] }) {
  const [links, setLinks] = useState<BookingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [doctorId, setDoctorId] = useState<string>("any");

  async function reload() {
    setLoading(true);
    const { data } = await supabase
      .from("booking_links")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    setLinks((data as BookingLink[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [organizationId]);

  async function createLink() {
    if (!label.trim()) { toast.error("Dê um nome ao link (ex: 'Site da clínica')"); return; }
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) { setCreating(false); return; }
    const token = generateToken();
    const { error } = await supabase.from("booking_links").insert({
      organization_id: organizationId,
      created_by: userId,
      doctor_id: doctorId === "any" ? null : doctorId,
      label: label.trim(),
      token,
      is_active: true,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setLabel("");
    setDoctorId("any");
    toast.success("Link criado!");
    reload();
  }

  async function toggleActive(link: BookingLink) {
    await supabase.from("booking_links").update({ is_active: !link.is_active }).eq("id", link.id);
    reload();
  }

  async function removeLink(id: string) {
    if (!confirm("Excluir este link? Quem tiver a URL não poderá mais agendar.")) return;
    await supabase.from("booking_links").delete().eq("id", id);
    reload();
  }

  function publicUrl(token: string) {
    return `${window.location.origin}/agendar?t=${token}`;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Crie links únicos para enviar aos pacientes. Cada link permite agendar respeitando a disponibilidade configurada.
      </p>

      <Card className="bg-muted/30">
        <CardContent className="p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome do link</Label>
              <Input
                placeholder="Ex: Agendamento — Site da clínica"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Médico</Label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="any">Qualquer médico</option>
                {members.filter((m) => m.role === "owner" || m.role === "doctor").map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name ?? "Médico"}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={createLink} disabled={creating} className="w-full sm:w-auto">
            {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Gerar link público
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum link criado ainda.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => {
            const url = publicUrl(l.token);
            return (
              <Card key={l.id} className={l.is_active ? "" : "opacity-60"}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{l.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.doctor_id
                          ? members.find((m) => m.user_id === l.doctor_id)?.display_name ?? "Médico"
                          : "Qualquer médico"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(l)} title={l.is_active ? "Desativar" : "Ativar"}>
                        <ToggleLeft className={`w-4 h-4 ${l.is_active ? "text-emerald-600" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeLink(l.id)}
                        className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1.5">
                    <code className="text-xs flex-1 truncate">{url}</code>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado!"); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function generateToken(): string {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}
