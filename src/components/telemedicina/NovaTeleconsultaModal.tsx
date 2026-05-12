import { useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Loader2, Copy, Check, Mail, Video, ShieldCheck, QrCode, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefilledAppointmentId?: string;
  prefilledPatient?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  onCreated?: (teleconsultaId: string) => void;
}

// CPF: máscara + validação dos dígitos verificadores
const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
};

const isValidCPF = (raw: string): boolean => {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
};

export function NovaTeleconsultaModal({ open, onOpenChange, prefilledAppointmentId, prefilledPatient, onCreated }: Props) {
  const { toast } = useToast();
  const { organization } = useOrganization();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(prefilledPatient?.name ?? "");
  const [email, setEmail] = useState(prefilledPatient?.email ?? "");
  const [phone, setPhone] = useState(prefilledPatient?.phone ?? "");
  const [cpf, setCpf] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [consent, setConsent] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);

  const [created, setCreated] = useState<{ id: string; link: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setStep(1);
    setName(prefilledPatient?.name ?? "");
    setEmail(prefilledPatient?.email ?? "");
    setPhone(prefilledPatient?.phone ?? "");
    setCpf("");
    setChiefComplaint("");
    setScheduledAt("");
    setConsent(false);
    setSendEmail(true);
    setCreated(null);
    setQrDataUrl("");
    setCopied(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const ensureOrganizationId = async (): Promise<string | null> => {
    if (organization?.id) return organization.id;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // Try existing membership
    const { data: existing } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (existing?.organization_id) return existing.organization_id;
    // Auto-create org
    const orgName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Minha Clínica";
    const { data: newOrg, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: orgName, owner_id: user.id })
      .select()
      .single();
    if (orgErr || !newOrg) return null;
    await supabase.from("organization_members").insert({
      organization_id: newOrg.id,
      user_id: user.id,
      role: "owner",
      is_active: true,
    });
    return newOrg.id;
  };

  const handleCreate = async () => {
    if (!consent) {
      toast({ title: "Consentimento obrigatório", description: "Confirme o consentimento do paciente.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const orgId = await ensureOrganizationId();
    if (!orgId) {
      setLoading(false);
      toast({ title: "Não foi possível criar/identificar sua organização", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("create-teleconsulta", {
        body: {
          organization_id: orgId,
          patient_name: name,
          patient_email: email || null,
          patient_phone: phone || null,
          patient_cpf: cpf || null,
          patient_id: prefilledPatient?.id || null,
          appointment_id: prefilledAppointmentId || null,
          scheduled_at: scheduledAt || null,
          chief_complaint: chiefComplaint || null,
        },
      });
      if (error) throw error;
      const tcId = data.teleconsulta.id;
      const link = data.patientLink;

      // Marca consentimento médico
      await supabase.from("teleconsultas" as any).update({
        doctor_consent_at: new Date().toISOString(),
      }).eq("id", tcId);

      const qr = await QRCode.toDataURL(link, { width: 240, margin: 1 });
      setQrDataUrl(qr);
      setCreated({ id: tcId, link });
      setStep(3);

      if (sendEmail && email) {
        supabase.functions.invoke("send-teleconsulta-link", {
          body: {
            teleconsulta_id: tcId,
            patient_link: link,
            doctor_name: organization?.name ?? "MindMed",
            scheduled_at: scheduledAt || null,
          },
        }).catch(() => {});
      }

      onCreated?.(tcId);
      toast({ title: "Teleconsulta criada!", description: "Link gerado com sucesso." });
    } catch (err) {
      toast({
        title: "Erro ao criar teleconsulta",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Nova Teleconsulta
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Dados do paciente para a teleconsulta"}
            {step === 2 && "Confirmação e consentimento (CFM 2.314/2022)"}
            {step === 3 && "Sala criada — compartilhe o link com o paciente"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tc-name">Nome completo do paciente *</Label>
              <Input id="tc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Maria Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tc-cpf">CPF *</Label>
              <Input id="tc-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              <p className="text-xs text-muted-foreground">Obrigatório para identificação (CFM)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tc-email">E-mail</Label>
                <Input id="tc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="paciente@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tc-phone">WhatsApp</Label>
                <Input id="tc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tc-when">Data e hora (opcional)</Label>
              <Input id="tc-when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe em branco para consulta imediata</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tc-cc">Queixa principal</Label>
              <Textarea id="tc-cc" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} rows={3} placeholder="Motivo da consulta..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!name || !cpf}>
                Próximo <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div><strong>Paciente:</strong> {name}</div>
              <div><strong>CPF:</strong> {cpf}</div>
              {email && <div><strong>E-mail:</strong> {email}</div>}
              {phone && <div><strong>Telefone:</strong> {phone}</div>}
              {scheduledAt && <div><strong>Agendada:</strong> {new Date(scheduledAt).toLocaleString("pt-BR")}</div>}
              {chiefComplaint && <div><strong>Queixa:</strong> {chiefComplaint}</div>}
            </div>

            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-medium mb-1">Conformidade CFM</p>
                  <p className="text-xs leading-relaxed">
                    Resolução CFM nº 2.314/2022 exige consentimento prévio do paciente para teleconsulta.
                  </p>
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <span className="text-xs leading-relaxed">
                  Confirmo que obtive o <strong>consentimento verbal/escrito</strong> do paciente para realizar atendimento por telemedicina, conforme Resolução CFM nº 2.314/2022.
                </span>
              </label>
            </div>

            {email && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} />
                Enviar link automaticamente por e-mail
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>Voltar</Button>
              <Button onClick={handleCreate} disabled={!consent || loading} className="bg-gradient-to-r from-cyan-500 to-blue-600">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
                Criar Teleconsulta
              </Button>
            </div>
          </div>
        )}

        {step === 3 && created && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                <Check className="w-6 h-6 text-green-700" />
              </div>
              <h3 className="font-semibold">Sala criada com sucesso</h3>
              <p className="text-xs text-muted-foreground mt-1">Compartilhe o link com {name}</p>
            </div>

            <div className="space-y-2">
              <Label>Link do paciente</Label>
              <div className="flex gap-2">
                <Input value={created.link} readOnly className="text-xs font-mono" />
                <Button onClick={copyLink} size="icon" variant="outline">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {qrDataUrl && (
              <div className="bg-white border rounded-lg p-4 flex flex-col items-center gap-2">
                <QrCode className="w-4 h-4 text-muted-foreground" />
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
                <p className="text-xs text-muted-foreground">Paciente escaneia para entrar</p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => {
                  handleClose(false);
                  navigate(`/consulta/${created.id}`);
                }}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                <Video className="w-4 h-4 mr-2" /> Abrir Sala (Médico)
              </Button>
              {email && (
                <Button
                  variant="outline"
                  onClick={() => {
                    supabase.functions.invoke("send-teleconsulta-link", {
                      body: {
                        teleconsulta_id: created.id,
                        patient_link: created.link,
                        doctor_name: organization?.name,
                        scheduled_at: scheduledAt || null,
                      },
                    });
                    toast({ title: "E-mail reenviado", description: `Para ${email}` });
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" /> Reenviar por e-mail
                </Button>
              )}
              <Button variant="ghost" onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
