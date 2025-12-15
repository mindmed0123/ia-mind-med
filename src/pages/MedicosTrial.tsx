import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Shield, Clock, FileText, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function MedicosTrial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    password: '',
    confirmPassword: '',
  });

  const canceled = searchParams.get('checkout') === 'canceled';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      toast.error('Você precisa aceitar os termos de uso');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      // 1. Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: formData.name,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error('Este email já está cadastrado. Faça login.');
          navigate('/');
          return;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Erro ao criar conta');
      }

      // 2. Update profile with whatsapp
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.name,
          whatsapp: formData.whatsapp,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // 3. Create checkout session
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          userId: authData.user.id,
          email: formData.email,
          name: formData.name,
          whatsapp: formData.whatsapp,
          plan: 'mindmed_pro',
        },
      });

      if (checkoutError) {
        throw checkoutError;
      }

      if (checkoutData?.url) {
        // Redirect to Stripe checkout
        window.location.href = checkoutData.url;
      } else {
        throw new Error('Não foi possível criar a sessão de checkout');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Erro ao processar cadastro');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Brain, text: 'IA que gera laudos completos automaticamente' },
    { icon: FileText, text: 'CID-10 e condutas sugeridas pela IA' },
    { icon: Clock, text: 'Economize até 2h por dia em documentação' },
    { icon: Shield, text: 'Dados 100% seguros e criptografados' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Brain className="w-10 h-10 text-primary" />
            <span className="text-3xl font-bold text-primary">MindMed</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-bold text-foreground mb-2">
            Teste Grátis por 7 Dias
          </h1>
          <p className="text-muted-foreground text-lg">
            Comece agora e descubra como a IA pode transformar sua prática médica
          </p>
        </div>

        {canceled && (
          <div className="max-w-md mx-auto mb-6">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-center">
              <p className="font-medium">Checkout cancelado</p>
              <p className="text-sm">Você pode tentar novamente quando quiser.</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Benefits */}
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5" />
                  O que você vai ter acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-foreground pt-2">{benefit.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <span className="font-semibold text-foreground">Garantia total</span>
                </div>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• 7 dias grátis para testar tudo</li>
                  <li>• Cancele quando quiser, sem burocracia</li>
                  <li>• Sem cobrança durante o período de teste</li>
                  <li>• Suporte prioritário via WhatsApp</li>
                </ul>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              <p>Após o período de teste: <strong>R$ 299/mês</strong></p>
              <p>Plano PRO com acesso ilimitado a todas as funcionalidades</p>
            </div>
          </div>

          {/* Form */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Criar sua conta</CardTitle>
              <CardDescription>
                Preencha seus dados para começar o teste grátis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Dr. João Silva"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repita a senha"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                    Li e aceito os{' '}
                    <a href="/termos" className="text-primary underline" target="_blank">
                      Termos de Uso
                    </a>{' '}
                    e a{' '}
                    <a href="/privacidade" className="text-primary underline" target="_blank">
                      Política de Privacidade
                    </a>
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-lg"
                  disabled={loading || !acceptedTerms}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Processando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Começar teste grátis de 7 dias
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Você será redirecionado para adicionar um cartão de crédito.
                  <br />
                  Não será cobrado nada durante o período de teste.
                </p>
              </form>

              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  Já tem uma conta?{' '}
                  <button
                    onClick={() => navigate('/')}
                    className="text-primary font-medium hover:underline"
                  >
                    Fazer login
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
