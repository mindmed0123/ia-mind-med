import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Sparkles, ArrowRight, Crown } from "lucide-react";

interface FirstLaudoSuccessProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  timeSavedMinutes?: number;
}

export const FirstLaudoSuccess = ({
  open,
  onClose,
  onUpgrade,
  timeSavedMinutes = 15,
}: FirstLaudoSuccessProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header gradient */}
        <div className="gradient-primary p-6 text-center text-primary-foreground">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-1">
            Laudo gerado com sucesso!
          </h2>
          <p className="text-primary-foreground/80 text-sm">
            Você acabou de gerar seu primeiro laudo com IA
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Time saved */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-semibold">Tempo economizado</span>
            </div>
            <p className="text-4xl font-bold text-primary">
              ~{timeSavedMinutes} min
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              comparado ao preenchimento manual
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            {[
              "Laudos completos em menos de 1 minuto",
              "Transcrição por áudio com IA",
              "Hipóteses diagnósticas automáticas",
              "Exportação PDF profissional",
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={onUpgrade}
              size="lg"
              className="w-full h-13 gradient-primary shadow-medium hover:shadow-large transition-all font-semibold"
            >
              <Crown className="w-5 h-5 mr-2" />
              Desbloquear uso completo
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full text-muted-foreground"
            >
              Continuar explorando
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
