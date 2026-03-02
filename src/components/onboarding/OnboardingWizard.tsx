import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Activity } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { StepWelcome } from "./steps/StepWelcome";
import { StepProfile } from "./steps/StepProfile";
import { StepGuidedLaudo } from "./steps/StepGuidedLaudo";
import { StepConfirmation } from "./steps/StepConfirmation";

interface OnboardingWizardProps {
  onComplete: () => void;
  initialStep?: number;
  updateStep: (step: number) => Promise<void>;
  completeOnboarding: (laudoId?: string, timeSaved?: number) => Promise<void>;
}

const STEP_LABELS = ["Boas-vindas", "Perfil", "Primeiro Laudo", "Pronto!"];

export const OnboardingWizard = ({
  onComplete,
  initialStep = 1,
  updateStep,
  completeOnboarding,
}: OnboardingWizardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const [step, setStep] = useState(initialStep);
  const [startTime] = useState(Date.now());
  const [firstLaudoId, setFirstLaudoId] = useState<string>();

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const goToStep = async (nextStep: number) => {
    await trackEvent("onboarding_step_completed", { step, nextStep });
    await updateStep(nextStep);
    setStep(nextStep);
  };

  const handleFinish = async () => {
    const timeSaved = Math.round((Date.now() - startTime) / 1000);
    // Estimate: a manual report takes ~25 min, AI takes ~3 min → saves ~22 min
    const estimatedTimeSaved = firstLaudoId ? 22 * 60 : 0;
    await completeOnboarding(firstLaudoId, estimatedTimeSaved);
    await trackEvent("onboarding_completed", {
      totalTimeSeconds: timeSaved,
      estimatedTimeSaved: estimatedTimeSaved,
      generatedFirstLaudo: !!firstLaudoId,
    });
    onComplete();
  };

  const handleFirstLaudoCreated = async (laudoId: string) => {
    setFirstLaudoId(laudoId);
    await trackEvent("first_laudo_generated", { laudoId });
    await goToStep(4);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Activity className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MindMed
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Passo {step} de {totalSteps}
            </span>
            <span className="text-xs text-muted-foreground">{STEP_LABELS[step - 1]}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps */}
        {step === 1 && <StepWelcome onNext={() => goToStep(2)} />}
        {step === 2 && <StepProfile onNext={() => goToStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && (
          <StepGuidedLaudo
            onLaudoCreated={handleFirstLaudoCreated}
            onSkip={() => goToStep(4)}
            onBack={() => setStep(2)}
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
      </div>
    </div>
  );
};
