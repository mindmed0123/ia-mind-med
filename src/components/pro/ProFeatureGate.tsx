import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProFeatureGateProps {
  children: ReactNode;
  feature?: string;
  showPreview?: boolean;
  previewContent?: ReactNode;
}

export function ProFeatureGate({ 
  children, 
  feature = 'esta funcionalidade',
  showPreview = false,
  previewContent
}: ProFeatureGateProps) {
  const { subscription, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (subscription?.isPro) {
    return <>{children}</>;
  }

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="pt-6">
        {showPreview && previewContent && (
          <div className="relative mb-6">
            <div className="opacity-40 pointer-events-none blur-[2px]">
              {previewContent}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
        )}
        
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mx-auto mb-4 flex items-center justify-center">
            <Crown className="w-8 h-8 text-primary-foreground" />
          </div>
          
          <h3 className="text-xl font-bold mb-2">Recurso Exclusivo PRO</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Desbloqueie {feature} e tenha acesso a funcionalidades avançadas com o Plano PRO.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => navigate('/precos')}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <Lock className="w-4 h-4 mr-2" />
              Desbloquear no Plano PRO
            </Button>
            <Button variant="outline" onClick={() => navigate('/precos')}>
              Ver todos os planos
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4">
            Plano PRO: R$ 299/mês • Laudos ilimitados • Receituário completo
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
