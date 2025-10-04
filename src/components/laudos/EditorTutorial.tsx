import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, FileText } from "lucide-react";

interface EditorTutorialProps {
  show: boolean;
  onComplete: () => void;
}

export const EditorTutorial = ({ show, onComplete }: EditorTutorialProps) => {
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(show);

  useEffect(() => {
    setOpen(show);
  }, [show]);

  const steps = [
    {
      title: "Bem-vindo ao Editor de Laudos",
      description: "Preencha as 7 seções com as informações clínicas do paciente.",
      icon: <FileText className="w-12 h-12 text-primary mx-auto mb-4" />
    },
    {
      title: "Autosave Automático",
      description: "Suas alterações são salvas automaticamente a cada 5 segundos. Você não precisa se preocupar em salvar manualmente!",
      icon: <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
    },
    {
      title: "Campos Obrigatórios",
      description: "Para exportar o PDF, você deve preencher:\n• Hipótese Principal (seção 5A)\n• Conduta/Plano (seção 6)\n\nCampos obrigatórios são destacados em vermelho.",
      icon: <CheckCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
    }
  ];

  const currentStep = steps[step - 1];
  const isLastStep = step === steps.length;

  const handleNext = () => {
    if (isLastStep) {
      setOpen(false);
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    setOpen(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {currentStep.title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 text-center">
          {currentStep.icon}
          <DialogDescription className="text-base whitespace-pre-line">
            {currentStep.description}
          </DialogDescription>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index + 1 === step
                  ? 'bg-primary'
                  : index + 1 < step
                  ? 'bg-primary/50'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
          >
            Pular Tutorial
          </Button>
          <Button onClick={handleNext}>
            {isLastStep ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Começar
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};