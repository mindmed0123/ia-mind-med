import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getAttribution } from '@/lib/attribution';
import { trackViewContent, trackCompleteRegistration } from '@/lib/metaPixel';
import { validatePhone } from '@/lib/validation';
import {
  Brain,
  Shield,
  Clock,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';

const maskPhone = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const PASSWORD_RULES = [
  { label: 'Mínimo de 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Um número', test: (p: string) => /[0-9]/.test(p) },
];

export default function MedicosTrial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ whatsapp: false, password: false });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    password: '',
  });

  const canceled = searchParams.get('checkout') === 'canceled';

  useEffect(() => {
    trackViewContent('trial_medicos');
  }, []);

  const phoneOk = validatePhone(formData.whatsapp);
  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(formData.password) })),
    [formData.password]
  );
  const passwordOk = passwordChecks.every((c) => c.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ whatsapp: true, password: true });

    if (!phoneOk || !passwordOk) return;

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: formData.name,
            ...getAttribution(),
          },
        },
      });

      if (authError) {
        if (/already registered|already been registered/i.test(authError.message)) {
          toast.error('Este e-mail já tem conta. Entre com sua senha para continuar.');
          navigate('/?email=' + encodeURIComponent(formData.email));
          return;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Erro ao criar conta');
      }

      trackCompleteRegistration(authData.user.id);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.name,
          whatsapp: formData.whatsapp,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Erro ao salvar WhatsApp no perfil:', profileError);
      }

      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (/weak|pwned/i.test(msg)) {
        toast.error('Essa senha é muito comum. Escolha outra, com números e letras variadas.');
      } else {
        toast.error('Não conseguimos criar sua conta agora. Confira os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Brain, text: 'IA que gera laudos completos automaticamente' },
    { icon: FileText, text: 'Laudo estruturado com CID-10 para você revisar e assinar' },
    { icon: Clock, text: 'O prontuário pronto no fim da consulta' },
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
            Crie sua conta gratuita
          </h1>
          <p className="text-muted-foreground text-lg">
            Leva menos de um minuto. Você escolhe o plano depois de testar.
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
          <div className="space-y-6 order-2 lg:order-1">
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
                  <li>• 7 dias de teste com acesso completo</li>
                  <li>• Nada é cobrado hoje</li>
                  <li>• Cancele em dois cliques, dentro da plataforma</li>
                  <li>• Garantia de 30 dias após a primeira cobrança</li>
                  <li>• Suporte prioritário via WhatsApp</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Form */}
          <Card className="shadow-lg order-1 lg:order-2">
            <CardHeader>
              <CardTitle>Criar sua conta</CardTitle>
              <CardDescription>Sem cartão para criar a conta.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
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
                    autoComplete="email"
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
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.whatsapp}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp: maskPhone(e.target.value) })
                    }
                    onBlur={() => setTouched((t) => ({ ...t, whatsapp: true }))}
                    aria-invalid={touched.whatsapp && !phoneOk}
                    required
                  />
                  {touched.whatsapp && !phoneOk ? (
                    <p className="text-xs text-destructive">
                      Informe um número válido com DDD, por exemplo (11) 99999-9999.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Para enviar seu acesso e tirar dúvidas. Não usamos para disparo em massa.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Crie uma senha"
                      className="pr-10"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                      aria-invalid={touched.password && !passwordOk}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <ul className="space-y-1 pt-1">
                    {passwordChecks.map((rule) => (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-2 text-xs ${
                          rule.ok ? 'text-green-600' : 'text-muted-foreground'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 ${rule.ok ? 'opacity-100' : 'opacity-40'}`} />
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      Criando sua conta...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Criar minha conta
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground leading-relaxed">
                  Ao criar a conta você aceita os{' '}
                  <a href="/termos" className="text-primary underline" target="_blank" rel="noreferrer">
                    Termos de Uso
                  </a>{' '}
                  e a{' '}
                  <a href="/privacidade" className="text-primary underline" target="_blank" rel="noreferrer">
                    Política de Privacidade
                  </a>
                  .
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
