import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, Mic, FileText, CheckCircle, AlertCircle, Pill } from "lucide-react";
import { PatientDataForm } from "@/components/laudos/PatientDataForm";
import { LaudoViewer } from "@/components/laudos/LaudoViewer";
import { LaudoEditor } from "@/components/laudos/LaudoEditor";
import { TextInputMode } from "@/components/laudos/TextInputMode";
import { PrescriptionTab } from "@/components/laudos/PrescriptionTab";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type PipelineStage = 'idle' | 'uploading' | 'transcribing' | 'preparing' | 'calling_ai' | 'structuring' | 'saving' | 'completed' | 'error';

const STAGE_LABELS: Record<PipelineStage, string> = {
  idle: 'Aguardando',
  uploading: 'Enviando áudio...',
  transcribing: 'Transcrevendo consulta...',
  preparing: 'Preparando dados clínicos...',
  calling_ai: 'Chamando IA...',
  structuring: 'Estruturando laudo...',
  saving: 'Salvando...',
  completed: 'Laudo pronto!',
  error: 'Erro no processamento',
};

const NovoLaudo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [laudoId, setLaudoId] = useState<string | null>(searchParams.get('id'));
  const [laudo, setLaudo] = useState<any>(null);
  const [patientData, setPatientData] = useState<any>(null);
  const [transcript, setTranscript] = useState("");
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);
  const hasTriggeredGeneration = useRef(false);
  const [showEditor, setShowEditor] = useState(false);
  const [inputMode, setInputMode] = useState<'audio' | 'text'>('audio');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false); // double-submit guard
  const channelRef = useRef<any>(null);

  // ===== SUPABASE REALTIME (replaces polling) =====
  useEffect(() => {
    if (!laudoId) return;
    
    // Initial load
    loadLaudo();

    // Subscribe to realtime changes on this specific laudo
    const channel = supabase
      .channel(`laudo-${laudoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'laudos',
          filter: `id=eq.${laudoId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setLaudo(updated);
          
          // Update transcript
          if (updated.transcript?.text && updated.transcript.text !== transcript) {
            setTranscript(updated.transcript.text);
          }

          // Auto-populate patient data from AI extraction
          if (updated.patient_data && updated.status === 'completed') {
            const extracted = updated.patient_data;
            setPatientData((prev: any) => ({
              ...prev,
              iniciais: extracted.iniciais || prev?.iniciais || '',
              sexo: extracted.sexo || prev?.sexo || '',
              idade: extracted.idade || prev?.idade || '',
              queixa_principal: extracted.queixa_principal || prev?.queixa_principal || '',
              medicacoes: extracted.medicacoes || prev?.medicacoes || [],
              alergias: extracted.alergias || prev?.alergias || [],
              historico: extracted.historico || prev?.historico || '',
              sinais_vitais: extracted.sinais_vitais || prev?.sinais_vitais || {},
            }));
          }

          // Update pipeline stage based on status
          if (updated.transcript_status === 'error' || updated.audio_processing_status === 'error' || updated.status === 'error') {
            setPipelineStage('error');
          } else if (updated.status === 'completed') {
            setPipelineStage('completed');
            if (!hasShownSuccessToast) {
              toast({ title: 'Laudo gerado!', description: 'O laudo foi gerado com sucesso' });
              setHasShownSuccessToast(true);
            }
            setIsSubmitting(false);
          } else if (updated.status === 'generating') {
            setPipelineStage('calling_ai');
          } else if (updated.transcript_status === 'processing' || updated.audio_processing_status === 'processing') {
            setPipelineStage('transcribing');
          }

          // Auto-trigger generation when transcription completes
          if (
            updated.transcript_status === 'completed' &&
            updated.status !== 'completed' &&
            updated.status !== 'generating' &&
            !hasTriggeredGeneration.current &&
            updated.transcript?.text
          ) {
            hasTriggeredGeneration.current = true;
            handleGenerateLaudo(updated.transcript.text);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Set initial pipeline stage
      if (data.status === 'completed') {
        setPipelineStage('completed');
      } else if (data.status === 'generating') {
        setPipelineStage('calling_ai');
      } else if (data.status === 'error' || data.transcript_status === 'error') {
        setPipelineStage('error');
      } else if (data.transcript_status === 'processing' || data.audio_processing_status === 'processing') {
        setPipelineStage('transcribing');
      }
    } catch (error: any) {
      console.error('Error loading laudo:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar o laudo', variant: 'destructive' });
    }
  };

  const handleGenerateLaudo = useCallback(async (transcriptText?: string) => {
    if (!laudoId || isSubmitting) return;
    
    const textToUse = transcriptText || transcript;
    if (!textToUse) {
      toast({ title: 'Atenção', description: 'Aguarde a transcrição ser concluída', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    setPipelineStage('preparing');

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
      
      // Fallback: poll for completion in case Realtime is delayed
      const pollForCompletion = async (attempts = 0) => {
        if (attempts > 30) {
          setPipelineStage('error');
          setIsSubmitting(false);
          return;
        }
        const { data: updated } = await supabase
          .from('laudos')
          .select('*')
          .eq('id', laudoId)
          .single();
        if (updated?.status === 'completed') {
          setLaudo(updated);
          setPipelineStage('completed');
          setIsSubmitting(false);
          if (!hasShownSuccessToast) {
            toast({ title: 'Laudo gerado!', description: 'O laudo foi gerado com sucesso' });
            setHasShownSuccessToast(true);
          }
        } else if (updated?.status === 'error') {
          setLaudo(updated);
          setPipelineStage('error');
          setIsSubmitting(false);
        } else {
          setTimeout(() => pollForCompletion(attempts + 1), 2000);
        }
      };
      // Start polling as fallback after a short delay
      setTimeout(() => pollForCompletion(), 3000);
    } catch (error: any) {
      console.error('Error generating laudo:', error);
      setPipelineStage('error');
      setIsSubmitting(false);
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar laudo', variant: 'destructive' });
    }
  }, [laudoId, isSubmitting, transcript, patientData, toast]);

  const handleTextGenerate = async (text: string) => {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setPipelineStage('preparing');

    try {
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

      // Fallback polling for text generation
      const pollForCompletion = async (attempts = 0) => {
        if (attempts > 30) {
          setPipelineStage('error');
          setIsSubmitting(false);
          return;
        }
        const { data: updated } = await supabase
          .from('laudos')
          .select('*')
          .eq('id', newLaudo.id)
          .single();
        if (updated?.status === 'completed') {
          setLaudo(updated);
          setPipelineStage('completed');
          setIsSubmitting(false);
          if (!hasShownSuccessToast) {
            toast({ title: 'Laudo gerado!', description: 'O laudo foi gerado com sucesso' });
            setHasShownSuccessToast(true);
          }
        } else if (updated?.status === 'error') {
          setLaudo(updated);
          setPipelineStage('error');
          setIsSubmitting(false);
        } else {
          setTimeout(() => pollForCompletion(attempts + 1), 2000);
        }
      };
      setTimeout(() => pollForCompletion(), 3000);

      navigate(`/novo-laudo?id=${newLaudo.id}`, { replace: true });
    } catch (error: any) {
      console.error('Error generating laudo from text:', error);
      setPipelineStage('error');
      setIsSubmitting(false);
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar laudo', variant: 'destructive' });
    }
  };

  const handleAudioUploadComplete = async (url: string, path: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPipelineStage('uploading');

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

      if (createError) throw createError;

      setLaudoId(newLaudo.id);
      setPipelineStage('transcribing');

      toast({ title: "Processando áudio...", description: "A transcrição e geração do laudo serão automáticas" });

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

      navigate(`/novo-laudo?id=${newLaudo.id}`, { replace: true });
    } catch (error: any) {
      console.error('Error processing audio:', error);
      setPipelineStage('error');
      setIsSubmitting(false);
      toast({ title: 'Erro ao processar', description: error.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const retryTranscription = async () => {
    if (!laudoId || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setPipelineStage('transcribing');
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
      if (status === 429) description = 'Limite de uso atingido. Aguarde alguns minutos.';
      if (status === 402) description = 'Créditos insuficientes na API de transcrição.';
      setPipelineStage('error');
      setIsSubmitting(false);
      toast({ title: 'Erro', description, variant: 'destructive' });
    }
  };

  const handlePatientDataChange = (data: any) => {
    setPatientData(data);
    // Don't auto-regenerate on patient data change - user must explicitly click "Gerar Laudo"
  };

  // Pipeline status indicator component
  const PipelineStatus = () => {
    if (pipelineStage === 'idle' || pipelineStage === 'completed') return null;

    const stageConfig: Record<string, { icon: React.ReactNode; color: string }> = {
      uploading: { icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'border-primary bg-primary/5' },
      transcribing: { icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'border-primary bg-primary/5' },
      preparing: { icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'border-primary bg-primary/5' },
      calling_ai: { icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'border-accent bg-accent/5' },
      structuring: { icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'border-accent bg-accent/5' },
      saving: { icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'border-accent bg-accent/5' },
      error: { icon: <AlertCircle className="w-5 h-5 text-destructive" />, color: 'border-destructive bg-destructive/5' },
    };

    const config = stageConfig[pipelineStage] || stageConfig.error;

    return (
      <Card className={`mb-6 border-2 ${config.color}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {config.icon}
            <div className="flex-1">
              <p className="font-medium">{STAGE_LABELS[pipelineStage]}</p>
              {pipelineStage === 'transcribing' && (
                <p className="text-sm text-muted-foreground">A transcrição e geração do laudo serão automáticas</p>
              )}
              {(pipelineStage === 'calling_ai' || pipelineStage === 'preparing') && (
                <p className="text-sm text-muted-foreground">Analisando dados clínicos e gerando laudo estruturado...</p>
              )}
              {pipelineStage === 'saving' && (
                <p className="text-sm text-muted-foreground">Salvando laudo no banco de dados...</p>
              )}
            </div>
            {pipelineStage !== 'error' && (
              <Badge variant="outline" className="animate-pulse">Em progresso</Badge>
            )}
          </div>
          {pipelineStage === 'error' && (
            <Button onClick={retryTranscription} className="mt-4" disabled={isSubmitting}>
              Tentar novamente
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  // If no laudo exists yet, show the input mode selector
  if (!laudoId) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
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
              <PatientDataForm initialData={patientData} onDataChange={setPatientData} autoSave={false} />
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
                    isGenerating={isSubmitting}
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
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="text-3xl font-bold">
            {laudo?.status === 'completed' ? 'Editar Laudo' : 'Novo Laudo com IA'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {STAGE_LABELS[pipelineStage]}
          </p>
        </div>

        <PipelineStatus />

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
                  placeholder={pipelineStage === 'transcribing' ? "Transcrevendo..." : "Transcrição aparecerá aqui"}
                  disabled={pipelineStage === 'transcribing'}
                />
                
                {transcript && pipelineStage !== 'transcribing' && laudo?.status !== 'completed' && laudo?.status !== 'generating' && (
                  <Button
                    onClick={() => handleGenerateLaudo()}
                    disabled={isSubmitting}
                    className="w-full mt-4 whitespace-nowrap"
                  >
                    {isSubmitting ? (
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
                    {pipelineStage === 'transcribing' || pipelineStage === 'calling_ai' || pipelineStage === 'preparing' || pipelineStage === 'structuring' || pipelineStage === 'saving'
                      ? 'Processando... Os resultados aparecerão automaticamente.'
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