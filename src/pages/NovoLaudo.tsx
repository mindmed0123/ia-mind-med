import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit } from "lucide-react";
import { PatientDataForm } from "@/components/laudos/PatientDataForm";
import { LaudoViewer } from "@/components/laudos/LaudoViewer";
import { LaudoEditor } from "@/components/laudos/LaudoEditor";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NovoLaudo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [laudoId, setLaudoId] = useState<string | null>(searchParams.get('id'));
  const [laudo, setLaudo] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingLaudo, setIsGeneratingLaudo] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [transcript, setTranscript] = useState("");
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);
  const hasTriggeredGeneration = useRef(false);
  const [showEditor, setShowEditor] = useState(false);

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

        {laudoId && laudo ? (
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
                  
                  {transcript && !isProcessing && laudo.status !== 'completed' && (
                    <Button
                      onClick={() => handleGenerateLaudo()}
                      disabled={isGeneratingLaudo}
                      className="w-full mt-4"
                    >
                      {isGeneratingLaudo ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Gerando Laudo...
                        </>
                      ) : (
                        'Gerar Laudo com IA'
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {laudo.status === 'completed' ? (
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
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Grave um áudio no Dashboard para iniciar
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NovoLaudo;
