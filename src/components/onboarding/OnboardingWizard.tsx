import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { StepWelcome } from "./steps/StepWelcome";
import { StepProfile } from "./steps/StepProfile";
import { StepGuidedLaudo } from "./steps/StepGuidedLaudo";
import { StepConfirmation } from "./steps/StepConfirmation";

interface OnboardingWizardProps {
  /** Concluiu de fato (gerou laudo ou finalizou o guia). */
  onComplete: (laudoId?: string) => void;
  /** "Agora não" — fecha só na sessão atual. */
  onSnooze: () => void;
  initialStep?: number;
}

const STEP_LABELS = ["Boas-vindas", "Perfil", "Laudo de demonstração", "Pronto"];

export const OnboardingWizard = ({ onComplete, onSnooze, initialStep = 1 }: OnboardingWizardProps) => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const [step, setStep] = useState(initialStep);
  const [firstLaudoId, setFirstLaudoId] = useState<string>();

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    trackEvent("onboarding_shown", { step: initialStep });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToStep = (nextStep: number) => {
    trackEvent("onboarding_step_completed", { step, nextStep });
    setStep(nextStep);
  };

  const handleSnooze = () => {
    trackEvent("onboarding_skipped", { step });
    onSnooze();
  };

  const handleFinish = () => {
    onComplete(firstLaudoId);
  };

  const handleFirstLaudoCreated = (laudoId: string) => {
    setFirstLaudoId(laudoId);
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Activity className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MindMed
            </span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Passo {step} de {totalSteps}
            </span>
            <span className="text-xs text-muted-foreground">{STEP_LABELS[step - 1]}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {step === 1 && <StepWelcome onNext={() => goToStep(2)} />}
        {step === 2 && <StepProfile onNext={() => goToStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && (
          <StepGuidedLaudo
            onLaudoCreated={handleFirstLaudoCreated}
            onSkip={handleSnooze}
            onBack={() => setStep(2)}
            skipLabel="Agora não"
          />
        )}
        {step === 4 && (
          <StepConfirmation
            firstLaudoId={firstLaudoId}
            onFinish={handleFinish}
            onGoToLaudo={() => {
              handleFinish();
              navigate("/novo-laudo");
            }}
          />
        )}

        {step < 4 && (
          <div className="text-center mt-4">
            <Button variant="link" className="text-xs text-muted-foreground" onClick={handleSnooze}>
              Agora não
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
