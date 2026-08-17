import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Activity, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const emailSchema = z.string().email({ message: "Email inválido" }).max(255, { message: "Email muito longo" }).trim().toLowerCase();

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  const getNextPath = (): string => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/dashboard";
  };

  useEffect(() => {
    if (user) {
      navigate(getNextPath());
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const emailResult = emailSchema.safeParse(loginData.email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    if (!loginData.password || loginData.password.length < 8) {
      toast.error("Senha deve ter no mínimo 8 caracteres");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await signIn(emailResult.data, loginData.password);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error("Erro ao fazer login");
        }
      } else {
        toast.success("Login realizado com sucesso!");
        navigate(getNextPath());
      }
    } catch {
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginData.email) {
      toast.error("Digite seu email primeiro");
      return;
    }
    const emailResult = emailSchema.safeParse(loginData.email);
    if (!emailResult.success) {
      toast.error("Email inválido");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailResult.data, {
        redirectTo: `${window.location.origin}/dashboard`,
      });
      if (error) throw error;
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
    } catch {
      toast.error("Erro ao enviar email de recuperação. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 gradient-subtle">
      <div className="w-full max-w-md">
        <Link to="/home" className="flex items-center justify-center gap-2 text-2xl font-bold mb-8">
          <Activity className="w-8 h-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            MindMed
          </span>
        </Link>

        <Card className="shadow-large">
          <CardHeader className="text-center pb-4">
            <h1 className="text-2xl font-bold">Bem-vindo</h1>
            <p className="text-muted-foreground">Acesse sua conta</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="login-email" type="email" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} placeholder="seu@email.com" className="pl-10" required />
                </div>
              </div>

              <div>
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="login-password" type="password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} placeholder="••••••••" className="pl-10" required />
                </div>
              </div>

              <div className="text-right">
                <button type="button" onClick={handleForgotPassword} className="text-sm text-primary hover:underline">
                  Esqueceu a senha?
                </button>
              </div>

              <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Ainda não tem conta?{" "}
                <Link to="/medicos/teste-gratis" className="text-primary font-medium hover:underline">
                  Comece seu teste de 7 dias
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
