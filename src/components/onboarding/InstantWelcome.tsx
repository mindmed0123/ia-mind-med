import { Button } from "@/components/ui/button";
import { Mic, Shield, Zap, Clock } from "lucide-react";
import { Activity } from "lucide-react";

interface InstantWelcomeProps {
  onStart: () => void;
  onSkip: () => void;
  userName?: string;
}

export const InstantWelcome = ({ onStart, onSkip, userName }: InstantWelcomeProps) => {
  const firstName = userName?.split(" ")[0] || "Doutor(a)";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-background via-background to-primary/5">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Activity className="w-8 h-8 text-primary" />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            MindMed
          </span>
        </div>

        {/* Hero */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Sua IA médica está pronta.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Grave sua consulta e a MindMed cria seu laudo automaticamente.
          </p>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Button
            onClick={onStart}
            size="lg"
            className="w-full h-16 text-lg font-semibold gradient-primary shadow-large hover:shadow-xl transition-all hover:scale-[1.02] rounded-xl"
          >
            <Mic className="w-6 h-6 mr-3" />
            Começar consulta agora
          </Button>
          <Button
            onClick={onSkip}
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Pular e ir para o Dashboard
          </Button>
        </div>

        {/* Trust signals */}
        <div className="grid grid-cols-1 gap-3 pt-4">
          <div className="flex items-center gap-3 text-left p-3 rounded-lg bg-muted/40">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Leva menos de 1 minuto</p>
              <p className="text-xs text-muted-foreground">Fale normalmente, a IA organiza tudo</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-left p-3 rounded-lg bg-muted/40">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Economize ~20 min por laudo</p>
              <p className="text-xs text-muted-foreground">Transcrição + estruturação automática</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-left p-3 rounded-lg bg-muted/40">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Seus dados são protegidos</p>
              <p className="text-xs text-muted-foreground">Criptografia + conformidade LGPD</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
