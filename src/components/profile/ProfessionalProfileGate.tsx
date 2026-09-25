import { Card, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { ProfessionalProfileForm } from './ProfessionalProfileForm';
import type { ProfessionalProfile } from '@/hooks/useProfessionalProfile';

interface Props {
  initial?: ProfessionalProfile | null;
  onSaved: () => void;
  onSkip: () => void;
}

// Tela pós-login exibida enquanto perfil_completo_em é null.
export const ProfessionalProfileGate = ({ initial, onSaved, onSkip }: Props) => {
  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Activity className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            MindMed
          </span>
        </div>
        <Card className="shadow-large">
          <CardContent className="pt-6 pb-6">
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold">Antes de começar</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Isso ajusta os documentos que a MindMed gera para você.
              </p>
            </div>
            <ProfessionalProfileForm initial={initial} onSaved={onSaved} onSkip={onSkip} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
