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
import { useVagasFundador } from '@/hooks/useVagasFundador';
import { Activity, Check, ShieldCheck, ArrowRight } from 'lucide-react';

const PLAN_ORDER = ['mindmed_fundador', 'mindmed_pro_anual', 'mindmed_pro', 'mindmed_starter'];
const PLAN_ORDER_PARCEIRO = ['mindmed_pro_anual', 'mindmed_pro', 'mindmed_starter'];
const PLANOS_COM_DESCONTO: string[] = ['mindmed_pro', 'mindmed_pro_anual'];

export default function Precos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { restantes: vagasRestantes } = useVagasFundador();
  const [parceiroToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem('mm_parceiro'); } catch { return null; }
  });
  const [parceiro, setParceiro] = useState<{ percentual: number; rotulo: string } | null>(null);

  useEffect(() => {
    if (!parceiroToken) return;
    let ativo = true;
    supabase.functions
      .invoke('validar-parceiro', { body: { parceiro: parceiroToken } })
      .then(({ data }) => {
        if (ativo && data?.valido && typeof data.percentual === 'number' && data.rotulo) {
          setParceiro({ percentual: data.percentual, rotulo: String(data.rotulo) });
        }
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, [parceiroToken]);

  const fundadorDisponivel = vagasRestantes > 0 && !parceiro;
  const ordem = parceiro ? PLAN_ORDER_PARCEIRO : PLAN_ORDER;

  const planosVisiveis = [...SUBSCRIPTION_PLANS]
    .filter((p) => p.id !== 'mindmed_fundador' || fundadorDisponivel)
    .sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));

  const planoPadrao = fundadorDisponivel ? 'mindmed_fundador' : 'mindmed_pro_anual';

  const precoComDesconto = (plan: (typeof SUBSCRIPTION_PLANS)[number]) => {
    if (!parceiro || !PLANOS_COM_DESCONTO.includes(plan.id)) return null;
    const valor = plan.priceValue * (1 - parceiro.percentual / 100);
    const fmt = valor.toLocaleString('pt-BR', { minimumFractionDigits: valor % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return `R$ ${fmt}${plan.id === 'mindmed_pro_anual' ? '/ano' : '/mês'}`;
  };
  const [selectedPlan, setSelectedPlan] = useState(planoPadrao);

  useEffect(() => {
    setSelectedPlan(planoPadrao);
  }, [planoPadrao]);

  useEffect(() => {
    trackViewContent('precos');
  }, []);

  const handleSelect = async (planId: string) => {
    setSelectedPlan(planId);
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
          ...(parceiroToken ? { parceiro: parceiroToken } : {}),
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Não foi possível criar a sessão de checkout');
      window.location.href = data.url;
    } catch (err: any) {
      console.error('checkout error', err);
      toast.error(
        'Não conseguimos abrir o pagamento agora. Sua conta continua ativa — tente de novo em instantes ou fale com o suporte no WhatsApp.'
      );
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

        {parceiro && (
          <div className="mb-6 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary">
            Condição exclusiva para associados da {parceiro.rotulo} aplicada.
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Planos MindMed</h1>
          <p className="text-muted-foreground text-lg">
            7 dias de teste. Escolha o plano que combina com o seu volume de consultas.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 items-stretch">
          {planosVisiveis.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <Card
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`flex flex-col cursor-pointer ${
                  isSelected ? 'border-primary border-2 shadow-large ring-1 ring-primary' : 'shadow-soft'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">{plan.label}</CardTitle>
                    {plan.badge && <Badge variant={isSelected ? 'default' : 'secondary'}>{plan.badge}</Badge>}
                  </div>
                  {precoComDesconto(plan) ? (
                    <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                      <p className="text-3xl font-bold">{precoComDesconto(plan)}</p>
                      <p className="text-sm text-muted-foreground line-through">{plan.price}</p>
                    </div>
                  ) : (
                    <p className="text-3xl font-bold mt-2">{plan.price}</p>
                  )}
                  <CardDescription>{plan.description}</CardDescription>
                  {plan.id === 'mindmed_fundador' && (
                    <p className="text-xs text-primary mt-1">Restam {vagasRestantes} de 100 vagas</p>
                  )}
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
                    className={`w-full ${isSelected ? 'gradient-primary' : ''}`}
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={loadingPlan === plan.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(plan.id);
                    }}
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
            );
          })}
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
