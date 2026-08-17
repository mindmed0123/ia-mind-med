import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getAttribution } from '@/lib/attribution';
import { trackViewContent, trackInitiateCheckout } from '@/lib/metaPixel';
import { SUBSCRIPTION_PLANS, GUARANTEE_TEXT } from '@/lib/subscription-plans';
import { Activity, Check, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Precos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    trackViewContent('precos');
  }, []);

  const handleSelect = async (planId: string) => {
    trackInitiateCheckout(planId);

    if (!user) {
      navigate(`/medicos/teste-gratis?plan=${planId}`);
      return;
    }

    setLoadingPlan(planId);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, whatsapp')
        .eq('id', user.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          userId: user.id,
          email: user.email,
          name: profile?.full_name || '',
          whatsapp: profile?.whatsapp || '',
          plan: planId,
          attribution: getAttribution(),
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Não foi possível criar a sessão de checkout');
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao iniciar o checkout');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen gradient-subtle px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="flex items-center justify-center gap-2 text-2xl font-bold mb-8">
          <Activity className="w-8 h-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">MindMed</span>
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Planos MindMed</h1>
          <p className="text-muted-foreground text-lg">
            7 dias de teste. Escolha o plano que combina com o seu volume de consultas.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 items-stretch">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`flex flex-col ${plan.recommended ? 'border-primary border-2 shadow-large' : 'shadow-soft'}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xl">{plan.label}</CardTitle>
                  {plan.badge && <Badge variant={plan.recommended ? 'default' : 'secondary'}>{plan.badge}</Badge>}
                </div>
                <p className="text-3xl font-bold mt-2">{plan.price}</p>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 justify-between gap-6">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${plan.recommended ? 'gradient-primary' : ''}`}
                  variant={plan.recommended ? 'default' : 'outline'}
                  disabled={loadingPlan === plan.id}
                  onClick={() => handleSelect(plan.id)}
                >
                  {loadingPlan === plan.id ? (
                    'Processando...'
                  ) : (
                    <span className="flex items-center gap-2">
                      {user ? 'Assinar agora' : 'Começar o teste'}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 max-w-2xl mx-auto rounded-lg border bg-card p-5 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">{GUARANTEE_TEXT}</p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{' '}
          <Link to="/" className="text-primary hover:underline font-medium">
            Entrar na plataforma
          </Link>
        </p>
      </div>
    </div>
  );
}
