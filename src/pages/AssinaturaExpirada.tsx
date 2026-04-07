import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Brain, AlertTriangle, CreditCard, MessageCircle, LogOut, ArrowRight, Sparkles } from 'lucide-react';

export default function AssinaturaExpirada() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    
    setHasSubscription(!!data);
  };

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
          plan: 'mindmed_pro',
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

  // Different messaging based on whether user ever had a subscription
  const isNewUser = hasSubscription === false;

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
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isNewUser ? 'bg-primary/10' : 'bg-amber-100'}`}>
              {isNewUser ? (
                <Sparkles className="w-8 h-8 text-primary" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              )}
            </div>
            <CardTitle className="text-2xl text-foreground">
              {isNewUser 
                ? "Ative sua assinatura MindMed" 
                : "Seu acesso à MindMed foi interrompido"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {isNewUser
                ? "Para acessar a plataforma, você precisa ativar sua assinatura com 7 dias grátis."
                : "Seu período de teste gratuito terminou ou sua assinatura não está ativa no momento."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-muted-foreground">
                {isNewUser
                  ? "Comece agora com 7 dias grátis e descubra como a IA pode transformar sua prática médica."
                  : "Para continuar usando a IA que gera laudos, CID e receituário automaticamente, reative sua assinatura."}
              </p>
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
                    {isNewUser ? "Começar 7 dias grátis" : "Reativar minha assinatura"}
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {isNewUser 
                  ? "7 dias grátis • Depois R$ 299/mês • Cancele quando quiser"
                  : "Plano PRO: R$ 299/mês • Cancele quando quiser"}
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
          Se você acredita que isso é um erro, entre em contato com nosso suporte.
        </p>
      </div>
    </div>
  );
}