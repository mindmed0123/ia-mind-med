import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

// Validation schemas for secure authentication
const emailSchema = z.string().email({
  message: "Email inválido"
}).max(255, {
  message: "Email muito longo"
}).trim().toLowerCase();
const passwordSchema = z.string().min(8, {
  message: "Senha deve ter no mínimo 8 caracteres"
}).max(128, {
  message: "Senha muito longa"
}).regex(/[A-Z]/, {
  message: "Senha deve conter pelo menos uma letra maiúscula"
}).regex(/[a-z]/, {
  message: "Senha deve conter pelo menos uma letra minúscula"
}).regex(/[0-9]/, {
  message: "Senha deve conter pelo menos um número"
});
const nameSchema = z.string().min(3, {
  message: "Nome deve ter no mínimo 3 caracteres"
}).max(100, {
  message: "Nome muito longo"
}).trim();
const Auth = () => {
  const navigate = useNavigate();
  const {
    signIn,
    signUp,
    user
  } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate email
    const emailResult = emailSchema.safeParse(loginData.email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    // Validate password (minimum requirements for login)
    if (!loginData.password || loginData.password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      setIsLoading(false);
      return;
    }
    try {
      const {
        error
      } = await signIn(emailResult.data, loginData.password);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error("Erro ao fazer login");
        }
      } else {
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate full name
    const nameResult = nameSchema.safeParse(signupData.name);
    if (!nameResult.success) {
      toast.error(nameResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    // Validate email
    const emailResult = emailSchema.safeParse(signupData.email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    // Validate password
    const passwordResult = passwordSchema.safeParse(signupData.password);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.errors[0].message);
      setIsLoading(false);
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      toast.error("As senhas não coincidem");
      setIsLoading(false);
      return;
    }
    try {
      const {
        error
      } = await signUp(emailResult.data, signupData.password, nameResult.data);
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado");
        } else {
          toast.error("Erro ao criar conta");
        }
      } else {
        toast.success("Conta criada com sucesso! Redirecionando...");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error("Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleGoogleLogin = () => {
    toast.info("Login com Google em breve!");
    // Em produção, integrar com Supabase Auth Google
  };
  return <div className="min-h-screen flex items-center justify-center px-4 py-12 gradient-subtle">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/home" className="flex items-center justify-center gap-2 text-2xl font-bold mb-8">
          <Activity className="w-8 h-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            MindMed
          </span>
        </Link>

        {/* Trial CTA Banner */}
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
          <p className="text-sm text-foreground mb-2">
            <strong>Novo por aqui?</strong> Teste grátis por 7 dias!
          </p>
          <Link to="/medicos/teste-gratis">
            <Button variant="default" size="sm" className="gradient-primary">
              Começar teste grátis
            </Button>
          </Link>
        </div>

        <Card className="shadow-large">
          <CardHeader className="text-center pb-4">
            <h1 className="text-2xl font-bold">Bem-vindo</h1>
            <p className="text-muted-foreground">
              Acesse sua conta ou crie uma nova
            </p>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input id="login-email" type="email" value={loginData.email} onChange={e => setLoginData({
                      ...loginData,
                      email: e.target.value
                    })} placeholder="seu@email.com" className="pl-10" required />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative mt-2">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input id="login-password" type="password" value={loginData.password} onChange={e => setLoginData({
                      ...loginData,
                      password: e.target.value
                    })} placeholder="••••••••" className="pl-10" required />
                    </div>
                  </div>

                  <div className="text-right">
                    <a href="#" className="text-sm text-primary hover:text-primary-hover">
                      Esqueceu a senha?
                    </a>
                  </div>

                  <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-card px-2 text-muted-foreground">
                        ou continue com
                      </span>
                    </div>
                  </div>

                  <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin}>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input id="signup-name" type="text" value={signupData.name} onChange={e => setSignupData({
                      ...signupData,
                      name: e.target.value
                    })} placeholder="Dr. João Silva" className="pl-10" required />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input id="signup-email" type="email" value={signupData.email} onChange={e => setSignupData({
                      ...signupData,
                      email: e.target.value
                    })} placeholder="seu@email.com" className="pl-10" required />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative mt-2">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input id="signup-password" type="password" value={signupData.password} onChange={e => setSignupData({
                      ...signupData,
                      password: e.target.value
                    })} placeholder="••••••••" className="pl-10" required />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mínimo 8 caracteres, incluindo maiúscula, minúscula e número
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="signup-confirm">Confirmar senha</Label>
                    <div className="relative mt-2">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input id="signup-confirm" type="password" value={signupData.confirmPassword} onChange={e => setSignupData({
                      ...signupData,
                      confirmPassword: e.target.value
                    })} placeholder="••••••••" className="pl-10" required />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Ao criar uma conta, você concorda com nossos{" "}
                    <Link to="/termos" className="text-primary hover:underline">
                      Termos de Uso
                    </Link>{" "}
                    e{" "}
                    <Link to="/privacidade" className="text-primary hover:underline">
                      Política de Privacidade
                    </Link>
                  </p>

                  <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                    {isLoading ? "Criando conta..." : "Criar conta grátis"}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-card px-2 text-muted-foreground">
                        ou continue com
                      </span>
                    </div>
                  </div>

                  <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin}>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        
      </div>
    </div>;
};
export default Auth;