import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Appointment, AppointmentStatus, AppointmentType } from "@/hooks/useAppointments";
import { OrgMember } from "@/hooks/useOrganization";
import { STATUS_LABEL, parseAppointmentError } from "@/lib/appointment-utils";
import { toast } from "sonner";
import { Loader2, Trash2, FileText, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  members: OrgMember[];
  types: AppointmentType[];
  initialStart?: Date | null;
  appointment?: Appointment | null;
  onSaved: () => void;
}

interface PatientOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentModal({
  open,
  onOpenChange,
  organizationId,
  members,
  types,
  initialStart,
  appointment,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEdit = !!appointment;

  const [doctorId, setDoctorId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [startStr, setStartStr] = useState<string>("");
  const [endStr, setEndStr] = useState<string>("");
  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [notes, setNotes] = useState("");

  // Patient selection
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [showPatientResults, setShowPatientResults] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setDoctorId(appointment.doctor_id);
      setTypeId(appointment.appointment_type_id ?? "");
      setStartStr(toLocalInput(new Date(appointment.start_at)));
      setEndStr(toLocalInput(new Date(appointment.end_at)));
      setStatus(appointment.status);
      setNotes(appointment.notes ?? "");
      setPatientId(appointment.patient_id);
      setPatientName(appointment.patient_name_snapshot);
      setPatientPhone(appointment.patient_phone_snapshot ?? "");
      setPatientEmail(appointment.patient_email_snapshot ?? "");
    } else {
      const start = initialStart ?? new Date();
      const defaultDuration = types[0]?.duration_minutes ?? 30;
      const end = new Date(start.getTime() + defaultDuration * 60_000);
      setDoctorId(user?.id ?? members[0]?.user_id ?? "");
      setTypeId(types[0]?.id ?? "");
      setStartStr(toLocalInput(start));
      setEndStr(toLocalInput(end));
      setStatus("scheduled");
      setNotes("");
      setPatientId(null);
      setPatientName("");
      setPatientPhone("");
      setPatientEmail("");
    }
    setPatientResults([]);
    setShowPatientResults(false);
  }, [open, appointment, initialStart, types, members, user]);

  // Auto-update end when type changes
  useEffect(() => {
    if (!typeId || !startStr) return;
    const t = types.find((x) => x.id === typeId);
    if (!t) return;
    const start = new Date(startStr);
    const newEnd = new Date(start.getTime() + t.duration_minutes * 60_000);
    setEndStr(toLocalInput(newEnd));
  }, [typeId]);

  // Search patients
  useEffect(() => {
    if (!patientName || patientName.length < 2 || patientId) {
      setPatientResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, name, phone, email")
        .eq("user_id", user!.id)
        .ilike("name", `%${patientName}%`)
        .limit(6);
      setPatientResults((data as PatientOption[]) ?? []);
      setShowPatientResults(true);
    }, 250);
    return () => clearTimeout(t);
  }, [patientName, patientId, user]);

  function selectPatient(p: PatientOption) {
    setPatientId(p.id);
    setPatientName(p.name);
    setPatientPhone(p.phone ?? "");
    setPatientEmail(p.email ?? "");
    setShowPatientResults(false);
  }

  async function handleSave() {
    if (!patientName.trim()) {
      toast.error("Preencha o nome do paciente para continuar.");
      return;
    }
    if (!doctorId) {
      toast.error("Selecione o médico responsável.");
      return;
    }
    if (!startStr || !endStr) {
      toast.error("Defina horário inicial e final.");
      return;
    }
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (end <= start) {
      toast.error("O horário final deve ser depois do horário inicial.");
      return;
    }

    setSaving(true);

    let finalPatientId = patientId;
    // Quick-create patient if not selected from search
    if (!finalPatientId && patientName.trim()) {
      const { data: newPatient, error: pErr } = await supabase
        .from("patients")
        .insert({
          user_id: user!.id,
          organization_id: organizationId,
          name: patientName.trim(),
          phone: patientPhone || null,
          email: patientEmail || null,
        })
        .select("id")
        .single();
      if (pErr) {
        toast.error("Erro ao cadastrar paciente: " + pErr.message);
        setSaving(false);
        return;
      }
      finalPatientId = newPatient.id;
    }

    const payload = {
      organization_id: organizationId,
      doctor_id: doctorId,
      patient_id: finalPatientId,
      patient_name_snapshot: patientName.trim(),
      patient_phone_snapshot: patientPhone || null,
      patient_email_snapshot: patientEmail || null,
      appointment_type_id: typeId || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status,
      notes: notes || null,
    };

    if (isEdit && appointment) {
      const { error } = await supabase.from("appointments").update(payload).eq("id", appointment.id);
      if (error) {
        toast.error(parseAppointmentError(error));
        setSaving(false);
        return;
      }
      toast.success("Agendamento atualizado.");
    } else {
      const { error } = await supabase
        .from("appointments")
        .insert({ ...payload, created_by: user!.id, source: "internal" });
      if (error) {
        toast.error(parseAppointmentError(error));
        setSaving(false);
        return;
      }
      toast.success("Agendamento criado.");
    }
    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!appointment) return;
    if (!confirm("Cancelar este agendamento?")) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", appointment.id);
    if (error) {
      toast.error(parseAppointmentError(error));
      return;
    }
    toast.success("Agendamento cancelado.");
    onSaved();
    onOpenChange(false);
  }

  function handleStartAttendance() {
    if (!appointment) return;
    onOpenChange(false);
    navigate(`/novo-laudo?patient_id=${appointment.patient_id ?? ""}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? "Editar agendamento" : "Novo agendamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Patient */}
          <div className="space-y-2 relative">
            <Label className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Paciente *
            </Label>
            <Input
              placeholder="Buscar ou digitar nome do paciente"
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                setPatientId(null);
              }}
              autoComplete="off"
            />
            {showPatientResults && patientResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {patientResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
                  >
                    <div className="font-medium">{p.name}</div>
                    {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                  </button>
                ))}
              </div>
            )}
            {!patientId && patientName.length >= 2 && (
              <p className="text-xs text-muted-foreground">
                Paciente novo será cadastrado automaticamente.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} type="email" placeholder="opcional" />
            </div>
          </div>

          {/* Doctor + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Médico *</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name ?? "Médico"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de atendimento</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.duration_minutes}min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início *</Label>
              <Input type="datetime-local" value={startStr} onChange={(e) => setStartStr(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim *</Label>
              <Input type="datetime-local" value={endStr} onChange={(e) => setEndStr(e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observações visíveis na agenda" />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row flex-wrap justify-between sm:justify-between">
          <div className="flex gap-2">
            {isEdit && (
              <Button variant="outline" onClick={handleDelete} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-1.5" /> Cancelar
              </Button>
            )}
            {isEdit && appointment?.patient_id && (
              <Button variant="secondary" onClick={handleStartAttendance}>
                <FileText className="w-4 h-4 mr-1.5" /> Iniciar atendimento
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar agendamento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
