import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, LogOut, FileAudio, FileText, Settings, Shield, Users, Pill, Bot, History } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { LgpdConsent } from "@/components/consent/LgpdConsent";
import { QuotaDisplay } from "@/components/quota/QuotaDisplay";
import { ProductivityMetrics } from "@/components/dashboard/ProductivityMetrics";
import { LaudoHistory } from "@/components/dashboard/LaudoHistory";
import { UpgradeBanner } from "@/components/upgrade/UpgradeBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useOnboarding } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { needsOnboarding, loading: onboardingChecking, state: onboardingState, updateStep, completeOnboarding } = useOnboarding();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleAudioUploadComplete = async (url: string, path: string) => {
    if (!user?.id) {
      console.error('User ID is missing');
      return;
    }
    console.log('handleAudioUploadComplete called with:', { url, path, userId: user?.id });
    try {
      const { data: newLaudo, error: createError } = await supabase
        .from('laudos')
        .insert({
          user_id: user?.id,
          title: `Laudo com áudio - ${new Date().toLocaleString('pt-BR')}`,
          source_audio_url: url,
          status: 'draft',
          audio_processing_status: 'processing',
          transcript_status: 'processing',
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating laudo:', createError);
        throw createError;
      }

      toast({
        title: "Processando áudio...",
        description: "A transcrição e geração do laudo serão automáticas",
      });

      navigate(`/novo-laudo?id=${newLaudo.id}`);

      const { data: initial } = await supabase.auth.getSession();
      let accessToken = initial?.session?.access_token;
      if (!accessToken) {
        console.error('No access token found');
        return;
      }
      
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed?.session?.access_token) {
        accessToken = refreshed.session.access_token;
      }

      await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio_url: url,
          audio_path: path,
          laudo_id: newLaudo.id,
          mode: 'complete',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
    } catch (error: any) {
      console.error('Error invoking transcribe-audio:', error, error?.context);
      const status = error?.context?.status || error?.status;
      const body = error?.context?.body ?? error?.body;
      const parsedBody = typeof body === 'string' ? body : body ? (body.error || JSON.stringify(body)) : '';
      const ctxError = error?.context?.error;
      const message = ctxError || parsedBody || error?.message || 'Tente novamente';

      toast({
        title: status === 401 ? 'Sessão expirada' : 'Erro ao processar',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/home");
  };

  if (loading || onboardingChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Show onboarding wizard for new users
  if (needsOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => window.location.reload()}
        initialStep={onboardingState.currentStep}
        updateStep={updateStep}
        completeOnboarding={completeOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {user && <LgpdConsent userId={user.id} />}
      
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MindMed
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden md:block">
                {user.email}
              </span>
              {!adminLoading && isAdmin && (
                <Button variant="outline" onClick={() => navigate('/admin')}>
                  <Shield className="w-5 h-5 mr-2" />
                  Admin
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => navigate('/perfil')}>
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-5 h-5 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground">
            Gerencie seus laudos e consultas de forma simples e eficiente
          </p>
        </div>

        {/* Upgrade Banner */}
        <div className="mb-6">
          <UpgradeBanner />
        </div>

        {/* Productivity Metrics */}
        <div className="mb-8">
          <ProductivityMetrics />
        </div>

        {/* Quota + Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <QuotaDisplay />
          </div>
          <div className="lg:col-span-2">
            <Card className="shadow-soft h-full">
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                  Ações Rápidas
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => navigate("/dav-chat")} 
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 h-auto py-3"
                  >
                    <Bot className="w-5 h-5 mr-2" />
                    <span>
                      MindChat
                      <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">PRO</span>
                    </span>
                  </Button>
                  <Button 
                    onClick={() => navigate("/novo-laudo")} 
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90 h-auto py-3"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Novo Laudo
                  </Button>
                  <Button 
                    onClick={() => navigate("/pacientes")} 
                    variant="outline"
                    className="h-auto py-3"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    Pacientes
                  </Button>
                  <Button 
                    onClick={() => navigate("/receituarios")} 
                    variant="outline"
                    className="h-auto py-3"
                  >
                    <Pill className="w-5 h-5 mr-2" />
                    Receituários
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Tabs: Transcrição + Histórico */}
        <Tabs defaultValue="transcricao" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="transcricao">
              <FileAudio className="w-4 h-4 mr-2" />
              Nova transcrição
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="w-4 h-4 mr-2" />
              Histórico de Laudos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcricao">
            <Card className="shadow-large">
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-6">Nova transcrição</h2>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="upload">
                      <FileAudio className="w-4 h-4 mr-2" />
                      Enviar arquivo
                    </TabsTrigger>
                    <TabsTrigger value="record">
                      <FileAudio className="w-4 h-4 mr-2" />
                      Gravar áudio
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload">
                    <AudioUploader onUploadComplete={handleAudioUploadComplete} />
                  </TabsContent>
                  <TabsContent value="record">
                    <AudioRecorder onRecordingComplete={handleAudioUploadComplete} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <LaudoHistory />
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Precisa de mais consultas?</p>
          <a href="/precos" className="text-primary hover:underline">
            Ver todos os planos →
          </a>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
