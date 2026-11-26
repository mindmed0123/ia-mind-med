import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppState } from '@/hooks/useAppState';
import { getSubscriptionPlanId, SUBSCRIPTION_PLANS, FREE_PLAN, BUSINESS_WHATSAPP_URL, GUARANTEE_TEXT, type SubscriptionPlanId } from '@/lib/subscription-plans';
import { getAttribution } from '@/lib/attribution';
import { Brain, AlertTriangle, CreditCard, MessageCircle, LogOut, ArrowRight, Sparkles } from 'lucide-react';

export default function AssinaturaExpirada() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { subscription } = useAppState();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(() =>
    getSubscriptionPlanId(subscription?.plan, subscription?.billingCycle, subscription?.planOrigem)
  );
  const [searchParams] = useSearchParams();
  const atLimit = searchParams.get('motivo') === 'limite';
  const isPendingCheckout = subscription?.status === 'PENDING_CHECKOUT';

  useEffect(() => {
    if (subscription) {
      setSelectedPlan(getSubscriptionPlanId(subscription.plan, subscription.billingCycle, subscription.planOrigem));
    }
  }, [subscription]);

  const handleReactivate = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      navigate('/');
      return;
    }

    setLoading(true);

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, whatsapp')
        .eq('id', user.id)
        .single();

      // Create new checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          userId: user.id,
          email: user.email,
          name: profile?.full_name || '',
          whatsapp: profile?.whatsapp || '',
          plan: selectedPlan,
          attribution: getAttribution(),
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Não foi possível criar a sessão de checkout');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Brain className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-primary">MindMed</span>
          </div>
        </div>

        <Card className="shadow-xl border-primary/20">
          <CardHeader className="text-center pb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isPendingCheckout ? 'bg-primary/10' : 'bg-amber-100'}`}>
              {isPendingCheckout ? (
                <Sparkles className="w-8 h-8 text-primary" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              )}
            </div>
            <CardTitle className="text-2xl text-foreground">
              {atLimit ? "Suas 5 consultas gratuitas foram utilizadas" : "Assine o MindMed Pro"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {atLimit
                ? `Escolha um plano para continuar. Seus documentos continuam todos disponíveis.`
                : "Consultas e MindChat ilimitados, com receituário, evolução do paciente e telemedicina."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-muted-foreground">
                {atLimit
                  ? "Assine o Pro para continuar gerando documentos."
                  : "Você pode continuar no Free (5 consultas gratuitas no total) ou liberar tudo com o Pro."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Escolha seu plano</p>
              <div className="grid gap-2">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <Button
                    key={plan.id}
                    type="button"
                    variant={selectedPlan === plan.id ? 'default' : 'outline'}
                    className="h-auto justify-between py-3"
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <span>{plan.label}</span>
                    <span className="text-xs opacity-80">{plan.price}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleReactivate}
                className="w-full h-12 text-lg"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Processando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Assinar o Pro
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {GUARANTEE_TEXT} Cancele quando quiser, pelo próprio painel.
              </p>
            </div>

            <div className="border-t pt-4 space-y-3">
              <a
                href="https://wa.me/5511958890212"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-primary hover:underline"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Precisa de ajuda? Fale conosco</span>
              </a>

              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                Continuar no plano Free
              </Button>
              <a href={BUSINESS_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-muted-foreground hover:underline">
                Clínica ou equipe? Conheça o Business
              </a>

              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da conta
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Dúvidas? Fale com o suporte pelo WhatsApp.
        </p>
      </div>
    </div>
  );
}