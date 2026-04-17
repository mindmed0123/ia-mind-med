import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, CalendarCheck2, Clock, User, ChevronLeft, ChevronRight, Check, Loader2, AlertCircle, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextResp {
  link: { label: string; organization_name: string; doctor_id: string | null };
  doctors: Array<{ user_id: string; display_name: string; display_color: string }>;
  appointment_types: Array<{ id: string; name: string; duration_minutes: number; color: string; description: string | null }>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function Agendar() {
  const [params] = useSearchParams();
  const token = params.get("t");

  const [ctx, setCtx] = useState<ContextResp | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [doctorId, setDoctorId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [date, setDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [chosenSlot, setChosenSlot] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ start: string } | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Fetch context once
  useEffect(() => {
    if (!token) { setLoadErr("Link inválido. Solicite um novo link de agendamento."); return; }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/get-public-availability?token=${encodeURIComponent(token)}&action=context`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
        );
        const data = await r.json();
        if (!r.ok) { setLoadErr(data.error ?? "Erro ao carregar agendamento"); return; }
        setCtx(data);
        if (data.doctors.length === 1) setDoctorId(data.doctors[0].user_id);
        if (data.appointment_types.length === 1) setTypeId(data.appointment_types[0].id);
      } catch {
        setLoadErr("Não foi possível carregar o agendamento. Tente novamente em instantes.");
      }
    })();
  }, [token]);

  // Fetch slots when day/doctor/type ready
  useEffect(() => {
    if (!token || !doctorId || !typeId || step !== 3) return;
    setLoadingSlots(true);
    setSlots([]);
    setChosenSlot(null);
    const dateStr = isoDate(date);
    fetch(
      `${SUPABASE_URL}/functions/v1/get-public-availability?token=${encodeURIComponent(token)}&action=slots&doctor_id=${doctorId}&type_id=${typeId}&date=${dateStr}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    )
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [token, doctorId, typeId, date, step]);

  const selectedDoctor = ctx?.doctors.find((d) => d.user_id === doctorId);
  const selectedType = ctx?.appointment_types.find((t) => t.id === typeId);

  async function handleSubmit() {
    setSubmitErr(null);
    if (!name.trim() || name.trim().length < 2) { setSubmitErr("Informe seu nome completo"); return; }
    if (!phone && !email) { setSubmitErr("Informe pelo menos telefone ou e-mail"); return; }
    if (!chosenSlot) { setSubmitErr("Selecione um horário"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/book-appointment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          token,
          doctor_id: doctorId,
          appointment_type_id: typeId,
          start_at: chosenSlot,
          patient: { name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim() },
        }),
      });
      const data = await r.json();
      if (!r.ok) { setSubmitErr(data.error ?? "Não foi possível agendar"); return; }
      setSuccess({ start: chosenSlot });
    } catch {
      setSubmitErr("Erro ao agendar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- RENDER STATES ---------- */

  if (loadErr) {
    return (
      <Shell>
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Não foi possível abrir</h2>
            <p className="text-sm text-muted-foreground">{loadErr}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!ctx) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <Activity className="w-7 h-7 text-primary animate-spin" />
        </div>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell orgName={ctx.link.organization_name}>
        <Card className="max-w-md mx-auto border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold">Agendamento confirmado!</h2>
            <p className="text-sm text-muted-foreground">
              Sua consulta com <strong>{selectedDoctor?.display_name}</strong> foi marcada para{" "}
              <strong>{formatFullDateTime(success.start)}</strong>.
            </p>
            <p className="text-xs text-muted-foreground pt-2">
              Em caso de imprevisto, entre em contato com a clínica.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell orgName={ctx.link.organization_name}>
      <div className="max-w-2xl mx-auto">
        {/* Stepper */}
        <div className="flex items-center justify-center mb-6 gap-1.5 text-xs">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={cn(
              "flex items-center gap-1.5",
              s < step ? "text-primary" : s === step ? "text-foreground font-semibold" : "text-muted-foreground",
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold",
                s < step ? "bg-primary border-primary text-primary-foreground" :
                s === step ? "border-primary" : "border-muted-foreground/30",
              )}>
                {s < step ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < 4 && <div className={cn("w-6 h-px", s < step ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            {/* STEP 1 — DOCTOR */}
            {step === 1 && (
              <>
                <Header icon={Stethoscope} title="Escolha o profissional" subtitle="Selecione com quem deseja se consultar" />
                {ctx.doctors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum profissional disponível.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {ctx.doctors.map((d) => (
                      <button
                        key={d.user_id}
                        onClick={() => setDoctorId(d.user_id)}
                        className={cn(
                          "p-4 rounded-lg border-2 text-left transition-all hover:border-primary/60 hover:bg-muted/30",
                          doctorId === d.user_id ? "border-primary bg-primary/5" : "border-border",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                            style={{ backgroundColor: d.display_color }}>
                            {(d.display_name ?? "?").charAt(0)}
                          </div>
                          <div className="font-medium text-sm">{d.display_name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <NavRow onNext={() => setStep(2)} nextDisabled={!doctorId} />
              </>
            )}

            {/* STEP 2 — TYPE */}
            {step === 2 && (
              <>
                <Header icon={CalendarCheck2} title="Tipo de atendimento" subtitle="Selecione o motivo da consulta" />
                {ctx.appointment_types.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum tipo configurado.</p>
                ) : (
                  <div className="space-y-2">
                    {ctx.appointment_types.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTypeId(t.id)}
                        className={cn(
                          "w-full p-4 rounded-lg border-2 text-left transition-all hover:border-primary/60 hover:bg-muted/30",
                          typeId === t.id ? "border-primary bg-primary/5" : "border-border",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-10 rounded" style={{ backgroundColor: t.color }} />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{t.name}</div>
                            {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {t.duration_minutes} min
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <NavRow onPrev={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!typeId} />
              </>
            )}

            {/* STEP 3 — DATE + SLOT */}
            {step === 3 && (
              <>
                <Header icon={Clock} title="Escolha um horário" subtitle={`${selectedDoctor?.display_name} · ${selectedType?.name}`} />

                <DatePicker date={date} onChange={setDate} />

                <div className="min-h-[160px]">
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      Sem horários disponíveis nesta data.<br />Selecione outro dia.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button
                          key={s}
                          onClick={() => setChosenSlot(s)}
                          className={cn(
                            "py-2 rounded-md border text-sm font-medium transition-all",
                            chosenSlot === s
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/60 hover:bg-muted/30",
                          )}
                        >
                          {formatTime(s)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <NavRow onPrev={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!chosenSlot} />
              </>
            )}

            {/* STEP 4 — PATIENT */}
            {step === 4 && (
              <>
                <Header icon={User} title="Seus dados" subtitle="Para confirmar o agendamento" />

                <div className="space-y-3">
                  <div>
                    <Label>Nome completo *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="João da Silva" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Telefone *</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" />
                    </div>
                  </div>
                  <div>
                    <Label>Observação (opcional)</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Algo que o médico deva saber" />
                  </div>
                </div>

                <Card className="bg-muted/40">
                  <CardContent className="p-3 text-sm space-y-1">
                    <div><strong>Profissional:</strong> {selectedDoctor?.display_name}</div>
                    <div><strong>Atendimento:</strong> {selectedType?.name} ({selectedType?.duration_minutes} min)</div>
                    <div><strong>Quando:</strong> {chosenSlot && formatFullDateTime(chosenSlot)}</div>
                  </CardContent>
                </Card>

                {submitErr && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {submitErr}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(3)} disabled={submitting}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-primary to-accent">
                    {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                    Confirmar agendamento
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

/* ---------- helpers ---------- */
function Shell({ children, orgName }: { children: React.ReactNode; orgName?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <CalendarCheck2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Agendamento online</h1>
            {orgName && <p className="text-[11px] text-muted-foreground leading-tight">{orgName}</p>}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 pb-1">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h2 className="font-bold text-base leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function NavRow({ onPrev, onNext, nextDisabled }: { onPrev?: () => void; onNext?: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex justify-between pt-2">
      {onPrev ? (
        <Button variant="ghost" onClick={onPrev}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
      ) : <span />}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled} className="bg-gradient-to-r from-primary to-accent">
          Continuar <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

function DatePicker({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
      {days.map((d) => {
        const sel = isoDate(d) === isoDate(date);
        return (
          <button
            key={d.toISOString()}
            onClick={() => onChange(d)}
            className={cn(
              "flex-shrink-0 w-14 py-2 rounded-lg border-2 text-center transition-all",
              sel ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/60",
            )}
          >
            <div className="text-[10px] uppercase opacity-80">{d.toLocaleDateString("pt-BR", { weekday: "short" })}</div>
            <div className="text-lg font-bold leading-none mt-1">{d.getDate()}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{d.toLocaleDateString("pt-BR", { month: "short" })}</div>
          </button>
        );
      })}
    </div>
  );
}

function isoDate(d: Date): string {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return t.toISOString().slice(0, 10);
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatFullDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
  });
}
