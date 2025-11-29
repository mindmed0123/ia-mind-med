import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, Mic, FileText } from "lucide-react";
import { PatientDataForm } from "@/components/laudos/PatientDataForm";
import { LaudoViewer } from "@/components/laudos/LaudoViewer";
import { LaudoEditor } from "@/components/laudos/LaudoEditor";
import { TextInputMode } from "@/components/laudos/TextInputMode";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NovoLaudo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [laudoId, setLaudoId] = useState<string | null>(searchParams.get('id'));
  const [laudo, setLaudo] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingLaudo, setIsGeneratingLaudo] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [transcript, setTranscript] = useState("");
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);
  const hasTriggeredGeneration = useRef(false);
  const [showEditor, setShowEditor] = useState(false);
  const [inputMode, setInputMode] = useState<'audio' | 'text'>('audio');

  useEffect(() => {
    if (laudoId) {
      loadLaudo();
      // Poll for transcription updates
      const interval = setInterval(() => {
        checkTranscriptionStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [laudoId]);

  const loadLaudo = async () => {
    if (!laudoId) return;
    
    try {
      const { data, error } = await supabase
        .from('laudos')
        .select('*')
        .eq('id', laudoId)
        .single();

      if (error) throw error;
      
      setLaudo(data);
      const transcriptData = data.transcript as any;
      if (transcriptData?.text) {
        setTranscript(transcriptData.text);
      }
      if (data.patient_data) {
        setPatientData(data.patient_data);
      }
    } catch (error: any) {
      console.error('Error loading laudo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o laudo',
        variant: 'destructive',
      });
    }
  };

  const checkTranscriptionStatus = async () => {
    if (!laudoId) return;

    const { data } = await supabase
      .from('laudos')
      .select('transcript_status, transcript, audio_processing_status, status, source_audio_url')
      .eq('id', laudoId)
      .single();

    if (data) {
      setIsProcessing(data.transcript_status === 'processing' || data.audio_processing_status === 'processing');
      
      const transcriptData = data.transcript as any;
      if (transcriptData?.text && transcriptData.text !== transcript) {
        setTranscript(transcriptData.text);
        
        // Auto-generate laudo when transcription is ready and not already generated
        if (
          data.transcript_status === 'completed' && 
          data.status !== 'completed' && 
          !isGeneratingLaudo && 
          !hasTriggeredGeneration.current
        ) {
          hasTriggeredGeneration.current = true;
          handleGenerateLaudo(transcriptData.text);
        }
      }
      
      // Update laudo state with latest statuses
      setLaudo(data);
    }
  };

  const handleGenerateLaudo = async (transcriptText?: string) => {
    if (!laudoId) return;
    
    const textToUse = transcriptText || transcript;
    if (!textToUse) {
      toast({
        title: 'Atenção',
        description: 'Aguarde a transcrição ser concluída',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingLaudo(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase.functions.invoke('generate-laudo', {
        body: {
          patient: {
            iniciais: patientData?.iniciais || 'N/I',
            sexo: patientData?.sexo || 'Não informado',
            idade: parseInt(patientData?.idade) || 0,
          },
          specialty: patientData?.especialidade || 'Não especificada',
          chief_complaint: patientData?.queixa_principal || 'Não informada',
          transcript: textToUse,
          vitals: patientData?.sinais_vitais || {},
          meds: patientData?.medicacoes || [],
          allergies: patientData?.alergias || [],
          exam_findings: '',
          contexto_clinico: patientData?.contexto_clinico || '',
          historico: patientData?.historico || '',
          laudo_id: laudoId,
          mode: 'fast',
        },
      });

      if (error) throw error;

      if (!hasShownSuccessToast) {
        toast({
          title: 'Laudo gerado!',
          description: 'O laudo foi gerado com sucesso',
        });
        setHasShownSuccessToast(true);
      }

      await loadLaudo();
    } catch (error: any) {
      console.error('Error generating laudo:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao gerar laudo',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingLaudo(false);
    }
  };

  const handleTextGenerate = async (text: string) => {
    if (!user) return;

    setIsGeneratingLaudo(true);

    try {
      // Create a new laudo for text mode
      const { data: newLaudo, error: createError } = await supabase
        .from('laudos')
        .insert({
          user_id: user.id,
          title: `Laudo - ${new Date().toLocaleString('pt-BR')}`,
          status: 'draft',
          transcript: { text, source: 'text_input' },
          transcript_status: 'completed',
          generation_mode: 'text',
        })
        .select()
        .single();

      if (createError) throw createError;

      setLaudoId(newLaudo.id);
      setTranscript(text);

      // Generate laudo
      const { error } = await supabase.functions.invoke('generate-laudo', {
        body: {
          patient: {
            iniciais: patientData?.iniciais || 'N/I',
            sexo: patientData?.sexo || 'Não informado',
            idade: parseInt(patientData?.idade) || 0,
          },
          specialty: patientData?.especialidade || 'Não especificada',
          chief_complaint: patientData?.queixa_principal || 'Não informada',
          transcript: text,
          vitals: patientData?.sinais_vitais || {},
          meds: patientData?.medicacoes || [],
          allergies: patientData?.alergias || [],
          exam_findings: '',
          contexto_clinico: patientData?.contexto_clinico || '',
          historico: patientData?.historico || '',
          laudo_id: newLaudo.id,
          mode: 'complete',
        },
      });

      if (error) throw error;

      toast({
        title: 'Laudo gerado!',
        description: 'O laudo foi gerado com sucesso',
      });

      // Navigate to the laudo
      navigate(`/novo-laudo?id=${newLaudo.id}`, { replace: true });
      await loadLaudo();
    } catch (error: any) {
      console.error('Error generating laudo from text:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao gerar laudo',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingLaudo(false);
    }
  };

  const handleAudioUploadComplete = async (url: string, path: string) => {
    try {
      // Create laudo
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

      if (createError) throw createError;

      setLaudoId(newLaudo.id);

      toast({
        title: "Processando áudio...",
        description: "A transcrição e geração do laudo serão automáticas",
      });

      // Start transcription
      const { data: initial } = await supabase.auth.getSession();
      let accessToken = initial?.session?.access_token;
      if (!accessToken) return;
      
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

      // Update URL
      navigate(`/novo-laudo?id=${newLaudo.id}`, { replace: true });
    } catch (error: any) {
      console.error('Error processing audio:', error);
      toast({
        title: 'Erro ao processar',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const retryTranscription = async () => {
    if (!laudoId) return;
    try {
      setIsProcessing(true);
      const { data: initial } = await supabase.auth.getSession();
      let accessToken = initial?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.');
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed?.session?.access_token) {
        accessToken = refreshed.session.access_token;
      }
      const sourceUrl = laudo?.source_audio_url;
      if (!sourceUrl) throw new Error('Áudio de origem não encontrado.');
      const { error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio_url: sourceUrl, laudo_id: laudoId, mode: 'fast' },
        headers: { Authorization: `Bearer ${accessToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (error) throw error;
      toast({ title: 'Reprocessando áudio...', description: 'Tentando novamente a transcrição.' });
    } catch (err: any) {
      const status = err?.context?.status || err?.status;
      let description = err?.message || 'Falha ao reenviar transcrição';
      if (status === 429) description = 'Limite de uso atingido. Aguarde alguns minutos ou verifique seus créditos.';
      if (status === 402) description = 'Créditos insuficientes na API de transcrição.';
      toast({ title: 'Erro', description, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePatientDataChange = async (data: any) => {
    setPatientData(data);
    
    // If laudo exists and transcript is ready, auto-update
    if (laudoId && transcript && laudo?.status === 'completed') {
      await handleGenerateLaudo();
    }
  };

  // If no laudo exists yet, show the input mode selector
  if (!laudoId) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Novo Laudo com IA</h1>
            <p className="text-muted-foreground mt-2">
              Escolha como deseja criar o laudo: gravando áudio ou digitando texto
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <PatientDataForm
                initialData={patientData}
                onDataChange={setPatientData}
                autoSave={false}
              />
            </div>

            <div className="lg:col-span-2">
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'audio' | 'text')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="audio">
                    <Mic className="w-4 h-4 mr-2" />
                    Gravar/Enviar Áudio
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <FileText className="w-4 h-4 mr-2" />
                    Escrever Consulta
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="audio">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mic className="w-5 h-5 text-primary" />
                        Modo Áudio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="upload">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                          <TabsTrigger value="upload">Enviar Arquivo</TabsTrigger>
                          <TabsTrigger value="record">Gravar Agora</TabsTrigger>
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

                <TabsContent value="text">
                  <TextInputMode 
                    onGenerate={handleTextGenerate}
                    isGenerating={isGeneratingLaudo}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="text-3xl font-bold">
            {laudo?.status === 'completed' ? 'Editar Laudo' : 'Novo Laudo com IA'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isProcessing
              ? 'Processando transcrição do áudio...'
              : (laudo?.transcript_status === 'error' || laudo?.audio_processing_status === 'error')
              ? 'Falha na transcrição do áudio'
              : laudo?.status === 'completed'
              ? 'Laudo gerado - edite os dados do paciente para atualizar'
              : 'Preencha os dados e gere o laudo estruturado'
            }
          </p>
        </div>

        {isProcessing && (
          <Card className="mb-6 border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Processando áudio...</p>
                  <p className="text-sm text-muted-foreground">
                    A transcrição e geração do laudo serão automáticas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {laudo && (laudo.transcript_status === 'error' || laudo.audio_processing_status === 'error') && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="font-medium text-destructive">Falha na transcrição do áudio.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Limite de uso/ créditos da API pode ter sido atingido. Tente novamente mais tarde.
              </p>
              <Button onClick={retryTranscription} className="mt-4">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <PatientDataForm
              initialData={patientData}
              onDataChange={handlePatientDataChange}
              autoSave={true}
            />

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Transcrição</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="transcript">Texto da Consulta</Label>
                <Textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={10}
                  className="mt-2"
                  placeholder={isProcessing ? "Aguardando transcrição..." : "Transcrição aparecerá aqui"}
                  disabled={isProcessing}
                />
                
                {transcript && !isProcessing && laudo?.status !== 'completed' && (
                  <Button
                    onClick={() => handleGenerateLaudo()}
                    disabled={isGeneratingLaudo}
                    className="w-full mt-4 whitespace-nowrap"
                  >
                    {isGeneratingLaudo ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      'Gerar Laudo'
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {laudo?.status === 'completed' ? (
              <Tabs defaultValue={showEditor ? "editor" : "viewer"} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="viewer" onClick={() => setShowEditor(false)}>
                    Visualizar
                  </TabsTrigger>
                  <TabsTrigger value="editor" onClick={() => setShowEditor(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="viewer" className="mt-6">
                  <LaudoViewer laudoId={laudoId} />
                </TabsContent>
                
                <TabsContent value="editor" className="mt-6">
                  <LaudoEditor 
                    laudoId={laudoId} 
                    initialData={laudo}
                    onStatusChange={(newStatus) => {
                      setLaudo({ ...laudo, status: newStatus });
                    }}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {isProcessing 
                      ? 'Aguarde a transcrição e geração automática do laudo...'
                      : 'Preencha os dados do paciente e clique em "Gerar Laudo com IA"'
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovoLaudo;
