import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Activity, Mail, Lock, User, Gift, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { trackSignupPurchase } from "@/lib/metaPixel";

const emailSchema = z.string().email({ message: "Email inválido" }).max(255).trim().toLowerCase();
const passwordSchema = z.string().min(8, { message: "Senha deve ter no mínimo 8 caracteres" }).max(128).regex(/[A-Z]/, { message: "Precisa de letra maiúscula" }).regex(/[a-z]/, { message: "Precisa de letra minúscula" }).regex(/[0-9]/, { message: "Precisa de número" });
const nameSchema = z.string().min(3, { message: "Nome deve ter no mínimo 3 caracteres" }).max(100).trim();

const TRIAL_BENEFITS = [
  "15 dias de acesso completo",
  "30 créditos de laudos com IA",
  "Transcrição automática de áudio",
  "Templates por especialidade médica",
  "Geração automática de laudos",
  "Sem cartão de crédito",
];

const TrialConvite = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const nameResult = nameSchema.safeParse(formData.name);
    if (!nameResult.success) {
      toast.error(nameResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    const emailResult = emailSchema.safeParse(formData.email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    const passwordResult = passwordSchema.safeParse(formData.password);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("As senhas não coincidem");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: emailResult.data,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: nameResult.data,
            trial_days: 15,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado");
        } else {
          toast.error("Erro ao criar conta");
        }
      } else {
        // Meta Pixel: dispara Lead + Purchase em cadastro de novo médico (trial 15d)
        trackSignupPurchase('trial_15d');
        toast.success("Conta criada com sucesso! Redirecionando...");
        navigate("/dashboard");
      }
    } catch {
      toast.error("Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 gradient-subtle">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-2">
          <Activity className="w-8 h-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            MindMed
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          <Gift className="w-5 h-5 text-accent" />
          <span className="text-sm font-medium text-accent">Convite Especial — Trial Estendido</span>
        </div>

        <Card className="shadow-large">
          <CardHeader className="text-center pb-4">
            <h1 className="text-2xl font-bold">15 dias grátis</h1>
            <p className="text-muted-foreground">Acesso completo sem precisar assinar</p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Benefits */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {TRIAL_BENEFITS.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* Signup form */}
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="trial-name">Nome completo</Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="trial-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Dr. João Silva"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="trial-email">Email</Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="trial-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="trial-password">Senha</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="trial-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo 8 caracteres, incluindo maiúscula, minúscula e número
                </p>
              </div>

              <div>
                <Label htmlFor="trial-confirm">Confirmar senha</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="trial-confirm"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                {isLoading ? "Criando conta..." : "Começar meu trial de 15 dias"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Este é um convite exclusivo. Após os 15 dias, você poderá assinar um plano para continuar usando.
        </p>
      </div>
    </div>
  );
};

export default TrialConvite;
