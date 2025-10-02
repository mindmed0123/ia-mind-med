import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, LogOut, FileAudio, FileText, Settings } from "lucide-react";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transcriptionCount, setTranscriptionCount] = useState(0);
  const [laudosCount, setLaudosCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    const { data, error } = await supabase
      .from('laudos')
      .select('*', { count: 'exact', head: false })
      .eq('user_id', user?.id);

    if (!error && data) {
      setLaudosCount(data.length);
      setTranscriptionCount(data.filter(l => l.transcript).length);
    }
  };

  const handleAudioUploadComplete = async (url: string, path: string) => {
    console.log('handleAudioUploadComplete called with:', { url, path, userId: user?.id });
    try {
      // Create laudo
      console.log('Creating laudo entry...');
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
      console.log('Laudo created successfully:', newLaudo.id);

      toast({
        title: "Processando áudio...",
        description: "A transcrição e geração do laudo serão automáticas",
      });

      // Start transcription - ensure fresh auth token
      console.log('Getting auth session...');
      const { data: initial } = await supabase.auth.getSession();
      let accessToken = initial?.session?.access_token;
      if (!accessToken) {
        console.error('No access token found');
        throw new Error('Sessão inválida. Faça login novamente.');
      }
      console.log('Access token obtained');
      // Try to refresh session to avoid expired token issues
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed?.session?.access_token) {
        accessToken = refreshed.session.access_token;
        console.log('Session refreshed');
      }

      console.log('Invoking transcribe-audio function...');
      const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
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

      console.log('transcribe-audio result:', { transcribeData, transcribeError });

      if (transcribeError) throw transcribeError;

      // Redirect to edit page
      navigate(`/novo-laudo?id=${newLaudo.id}`);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
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
              <Button variant="outline" size="icon">
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
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Bem-vindo ao Dashboard!
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus laudos e consultas de forma simples e eficiente
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-soft hover:shadow-medium transition-smooth">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileAudio className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{transcriptionCount}</p>
                  <p className="text-sm text-muted-foreground">Transcrições</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-smooth">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{laudosCount}</p>
                  <p className="text-sm text-muted-foreground">Laudos gerados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-smooth border-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">10/10</p>
                  <p className="text-sm text-muted-foreground">Créditos Starter</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Período de teste ativo até {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <Button 
            onClick={() => navigate("/novo-laudo")} 
            size="lg"
            className="w-full md:w-auto"
          >
            <FileText className="w-5 h-5 mr-2" />
            Gerar Novo Laudo com IA
          </Button>
        </div>

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

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Você está usando o plano <strong>Starter</strong> (Trial)</p>
          <Button variant="link" className="text-primary">
            Ver todos os planos →
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
