import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepProfileProps {
  onNext: () => void;
  onBack: () => void;
}

const SPECIALTIES = [
  "Cardiologia", "Dermatologia", "Endocrinologia", "Gastroenterologia",
  "Geriatria", "Ginecologia", "Neurologia", "Oftalmologia", "Ortopedia",
  "Pediatria", "Psiquiatria", "Pneumologia", "Urologia", "Clínica Geral",
  "Medicina de Família", "Outra",
];

export const StepProfile = ({ onNext, onBack }: StepProfileProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    crm: "",
    crm_uf: "",
    specialty: "",
  });
  // Registro já informado na tela "Antes de começar" — não pedimos de novo.
  const [registroSalvo, setRegistroSalvo] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase
      .from("profiles")
      .select("full_name, crm, crm_uf, specialty, conselho, registro_numero, registro_uf, especialidade")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const metaName = (user.user_metadata as { full_name?: string } | undefined)?.full_name ?? "";
        setProfile({
          full_name: data.full_name || metaName,
          crm: data.crm || "",
          crm_uf: data.crm_uf || "",
          specialty: data.specialty || "",
        });
        if (data.conselho && data.registro_numero) {
          const uf = data.registro_uf ? `/${data.registro_uf}` : "";
          const esp = data.especialidade ? ` · ${data.especialidade}` : "";
          setRegistroSalvo(`${data.conselho} ${data.registro_numero}${uf}${esp}`);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleSave = async () => {
    if (!profile.full_name.trim() || (!registroSalvo && !profile.crm.trim())) {
      toast({
        title: "Campos obrigatórios",
        description: registroSalvo ? "Preencha seu nome completo" : "Preencha seu nome completo e CRM",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(
          registroSalvo
            ? { full_name: profile.full_name.trim() }
            : {
                full_name: profile.full_name.trim(),
                crm: profile.crm.replace(/\D/g, ""),
                crm_uf: profile.crm_uf.toUpperCase(),
                specialty: profile.specialty.trim(),
              },
        )
        .eq("id", user?.id);

      if (error) throw error;
      onNext();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-large">
      <CardContent className="pt-6 pb-6">
        <div className="space-y-5">
          <div className="text-center mb-2">
            <User className="w-10 h-10 text-primary mx-auto mb-2" />
            <h2 className="text-lg font-semibold">Dados Profissionais</h2>
            <p className="text-sm text-muted-foreground">
              Essas informações aparecerão nos seus laudos
            </p>
          </div>

          <div>
            <Label htmlFor="ob_name">Nome completo no laudo *</Label>
            <Input
              id="ob_name"
              value={profile.full_name}
              onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Dr. João Silva"
            />
          </div>

          {registroSalvo ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Registro: </span>
              <span className="font-medium">{registroSalvo}</span>
              <p className="text-xs text-muted-foreground mt-0.5">Você pode alterar depois em Perfil.</p>
            </div>
          ) : (
            <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ob_crm">CRM *</Label>
              <Input
                id="ob_crm"
                value={profile.crm}
                onChange={(e) => setProfile((p) => ({ ...p, crm: e.target.value.replace(/\D/g, "") }))}
                placeholder="123456"
                maxLength={8}
              />
            </div>
            <div>
              <Label htmlFor="ob_uf">UF</Label>
              <Input
                id="ob_uf"
                value={profile.crm_uf}
                onChange={(e) => setProfile((p) => ({ ...p, crm_uf: e.target.value.toUpperCase() }))}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          <div>
            <Label>Especialidade</Label>
            <Select
              value={profile.specialty}
              onValueChange={(v) => setProfile((p) => ({ ...p, specialty: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione sua especialidade" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

            </>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? "Salvando..." : "Continuar"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
