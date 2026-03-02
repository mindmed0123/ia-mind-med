import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, Sparkles, Shield } from "lucide-react";

interface StepWelcomeProps {
  onNext: () => void;
}

export const StepWelcome = ({ onNext }: StepWelcomeProps) => {
  return (
    <Card className="shadow-large">
      <CardContent className="pt-8 pb-8">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-9 h-9 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-bold mb-2">Bem-vindo ao MindMed!</h1>
            <p className="text-muted-foreground">
              Sua plataforma de laudos médicos com inteligência artificial.
              <br />
              Vamos configurar tudo em <strong>menos de 3 minutos</strong>.
            </p>
          </div>

          <div className="grid gap-3 text-left">
            {[
              {
                icon: Clock,
                title: "Economia de tempo",
                desc: "Gere laudos completos em minutos, não horas",
              },
              {
                icon: Sparkles,
                title: "IA especializada",
                desc: "Transcrição por áudio e geração automática de laudos",
              },
              {
                icon: Shield,
                title: "Seguro e confiável",
                desc: "Dados criptografados e conformidade LGPD",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <item.icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={onNext} className="w-full" size="lg">
            Começar configuração
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
