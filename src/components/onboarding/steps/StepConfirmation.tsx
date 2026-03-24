import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, FileText, Activity, Trash2 } from "lucide-react";

interface StepConfirmationProps {
  firstLaudoId?: string;
  onFinish: () => void;
  onGoToLaudo: () => void;
}

export const StepConfirmation = ({ firstLaudoId, onFinish, onGoToLaudo }: StepConfirmationProps) => {
  const generated = !!firstLaudoId;

  return (
    <Card className="shadow-large">
      <CardContent className="pt-8 pb-8">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>

          <div>
            <h2 className="text-xl font-bold mb-1">Tudo pronto!</h2>
            <p className="text-muted-foreground">
              {generated
                ? "Seu perfil está configurado e você já viu como a IA funciona."
                : "Seu perfil está configurado."}
            </p>
          </div>

          {generated && (
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                  <Clock className="w-5 h-5" />
                  <span>Tempo estimado economizado</span>
                </div>
                <p className="text-3xl font-bold text-primary">~22 minutos</p>
                <p className="text-xs text-muted-foreground">
                  por laudo, comparado ao preenchimento manual
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <Trash2 className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  O laudo de teste será <strong>apagado automaticamente</strong> ao concluir o guia.
                </p>
              </div>
            </>
          )}

          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
            <p className="text-sm font-medium">O que você pode fazer agora:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 ml-1">
              <li className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                Gerar laudos por áudio ou texto
              </li>
              <li className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
                Gerenciar pacientes e histórico
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                Exportar PDFs profissionais
              </li>
            </ul>
          </div>

          <div className="grid gap-3">
            <Button onClick={onGoToLaudo} className="w-full" size="lg">
              <FileText className="w-5 h-5 mr-2" />
              Criar Meu Primeiro Laudo Real
            </Button>
            <Button variant="outline" onClick={onFinish} className="w-full">
              <Activity className="w-5 h-5 mr-2" />
              Ir para o Dashboard
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
