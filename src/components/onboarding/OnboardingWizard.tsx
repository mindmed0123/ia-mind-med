import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  User, FileText, CheckCircle, ArrowRight, ArrowLeft, 
  Activity, Sparkles 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ONBOARDING_KEY = "mindmed_onboarding_complete";

export const useOnboardingCheck = () => {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }

    const checkOnboarding = async () => {
      // Check localStorage first for speed
      const localDone = localStorage.getItem(`${ONBOARDING_KEY}_${user.id}`);
      if (localDone === "true") {
        setNeedsOnboarding(false);
        setChecking(false);
        return;
      }

      // Check if profile has essential fields filled
      const { data } = await supabase
        .from("profiles")
        .select("full_name, crm, specialty")
        .eq("id", user.id)
        .single();

      const profileComplete = !!(data?.full_name && data?.crm);
      if (profileComplete) {
        localStorage.setItem(`${ONBOARDING_KEY}_${user.id}`, "true");
      }
      setNeedsOnboarding(!profileComplete);
      setChecking(false);
    };

    checkOnboarding();
  }, [user]);

  return { needsOnboarding, checking };
};

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    full_name: "",
    crm: "",
    crm_uf: "",
    specialty: "",
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const steps = [
    { icon: User, label: "Perfil", description: "Seus dados profissionais" },
    { icon: FileText, label: "Primeiro Laudo", description: "Crie seu primeiro laudo" },
    { icon: CheckCircle, label: "Pronto!", description: "Tudo configurado" },
  ];

  const handleSaveProfile = async () => {
    if (!profile.full_name.trim() || !profile.crm.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha seu nome completo e CRM",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name.trim(),
          crm: profile.crm.replace(/\D/g, ""),
          crm_uf: profile.crm_uf.toUpperCase(),
          specialty: profile.specialty.trim(),
        })
        .eq("id", user?.id);

      if (error) throw error;
      setStep(2);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGoToLaudo = () => {
    localStorage.setItem(`${ONBOARDING_KEY}_${user?.id}`, "true");
    navigate("/novo-laudo");
  };

  const handleFinish = () => {
    localStorage.setItem(`${ONBOARDING_KEY}_${user?.id}`, "true");
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MindMed
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Configuração Inicial</h1>
          <p className="text-muted-foreground">
            Vamos preparar tudo para você em poucos passos
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <Progress value={progress} className="h-2 mb-3" />
          <div className="flex justify-between">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 text-xs ${
                  i + 1 <= step ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="shadow-large">
          <CardContent className="pt-6">
            {step === 1 && (
              <div className="space-y-5">
                <div className="text-center mb-2">
                  <User className="w-10 h-10 text-primary mx-auto mb-2" />
                  <h2 className="text-lg font-semibold">Dados Profissionais</h2>
                  <p className="text-sm text-muted-foreground">
                    Essas informações aparecerão nos seus laudos
                  </p>
                </div>

                <div>
                  <Label htmlFor="ob_name">Nome Completo *</Label>
                  <Input
                    id="ob_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="Dr. João Silva"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ob_crm">CRM *</Label>
                    <Input
                      id="ob_crm"
                      value={profile.crm}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, crm: e.target.value.replace(/\D/g, "") }))
                      }
                      placeholder="123456"
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ob_uf">UF</Label>
                    <Input
                      id="ob_uf"
                      value={profile.crm_uf}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, crm_uf: e.target.value.toUpperCase() }))
                      }
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ob_specialty">Especialidade</Label>
                  <Input
                    id="ob_specialty"
                    value={profile.specialty}
                    onChange={(e) => setProfile((p) => ({ ...p, specialty: e.target.value }))}
                    placeholder="Cardiologia"
                  />
                </div>

                <Button onClick={handleSaveProfile} className="w-full" disabled={saving}>
                  {saving ? "Salvando..." : "Continuar"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 text-center">
                <FileText className="w-12 h-12 text-primary mx-auto" />
                <h2 className="text-lg font-semibold">Crie seu primeiro laudo</h2>
                <p className="text-muted-foreground">
                  Experimente criar um laudo por áudio ou texto. Leva menos de 2 minutos!
                </p>

                <div className="grid gap-3">
                  <Button onClick={handleGoToLaudo} className="w-full" size="lg">
                    <FileText className="w-5 h-5 mr-2" />
                    Criar Primeiro Laudo
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(3)} className="text-sm">
                    Pular por agora
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Tudo pronto!</h2>
                <p className="text-muted-foreground">
                  Seu perfil está configurado. Você pode acessar o dashboard e começar a usar o MindMed.
                </p>

                <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    O que você pode fazer:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1.5 ml-6">
                    <li>• Transcrever consultas por áudio</li>
                    <li>• Gerar laudos com IA</li>
                    <li>• Gerenciar pacientes</li>
                    <li>• Exportar PDFs profissionais</li>
                  </ul>
                </div>

                <Button onClick={handleFinish} className="w-full" size="lg">
                  <Activity className="w-5 h-5 mr-2" />
                  Ir para o Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back button for steps > 1 */}
        {step > 1 && step < 3 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} className="mt-4 mx-auto flex">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
};
