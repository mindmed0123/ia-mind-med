import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit, Mic, FileText, CheckCircle, AlertCircle, Pill, Upload, Stethoscope, Send, X } from "lucide-react";
import { SmartProgress, type SmartStage } from "@/components/loading/SmartProgress";
import { useEmbeddedBridge } from "@/hooks/useEmbeddedBridge";
import { PatientDataForm } from "@/components/laudos/PatientDataForm";
import { LaudoViewer } from "@/components/laudos/LaudoViewer";
import { LaudoEditor } from "@/components/laudos/LaudoEditor";
import { TextInputMode } from "@/components/laudos/TextInputMode";
import { PrescriptionTab } from "@/components/laudos/PrescriptionTab";
import { ExamUploadSection } from "@/components/laudos/ExamUploadSection";
import { LaudoTemplateConfig, type LaudoSectionConfig } from "@/components/laudos/LaudoTemplateConfig";
import { PatientLinkingModal } from "@/components/laudos/PatientLinkingModal";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { TranscriptionStream } from "@/components/audio/TranscriptionStream";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSpecialtyTemplates } from "@/hooks/useSpecialtyTemplates";
import { useChunkedTranscription } from "@/hooks/useChunkedTranscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FirstLaudoSuccess } from "@/components/onboarding/FirstLaudoSuccess";
import { MindChatWidget } from "@/components/chat/MindChatWidget";
import { getCloudFunctionHeaders } from "@/lib/cloud-function-auth";
import { getPollingDelayMs, isReadyToGenerate, isTerminalLaudoState, shouldRetryDraftGeneration } from "@/lib/laudo-pipeline";

type PipelineStage = 'idle' | 'uploading' | 'transcribing' | 'preparing' | 'calling_ai' | 'structuring' | 'saving' | 'completed' | 'error';

const STAGE_LABELS: Record<PipelineStage, string> = {
  idle: 'Aguardando',
  uploading: 'Enviando áudio...',
  transcribing: '🎙️ Transcrevendo consulta com IA... (10-30s)',
  preparing: 'Preparando dados clínicos...',
  calling_ai: '🧠 Gerando laudo com IA... (5-15s)',
  structuring: 'Estruturando laudo...',
  saving: 'Salvando...',
  completed: '✅ Laudo pronto!',
  error: 'Erro no processamento',
};

const NovoLaudo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, session } = useAuth();
  const { templates: specialtyTemplates } = useSpecialtyTemplates();
  const { isEmbedded, bridgeToken, error: bridgeError, sendCompleted, sendCancelled } = useEmbeddedBridge();
  const chunkedTranscription = useChunkedTranscription();
  const [laudoId, setLaudoId] = useState<string | null>(searchParams.get('id'));
  const initialTab = searchParams.get('tab');
  const [laudo, setLaudo] = useState<any>(null);
  const [patientData, setPatientData] = useState<any>(null);
  const [transcript, setTranscript] = useState("");
  const hasShownSuccessToast = useRef(false);
  const hasTriggeredGeneration = useRef(false);
  const [showEditor, setShowEditor] = useState(initialTab === 'editor');
  const [inputMode, setInputMode] = useState<'audio' | 'text'>('audio');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientLinked, setPatientLinked] = useState(false);
  const patientModalDismissedRef = useRef(false);
  const [showFirstLaudoSuccess, setShowFirstLaudoSuccess] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [laudoRefreshKey, setLaudoRefreshKey] = useState(0);
  const [laudoTemplateSections, setLaudoTemplateSections] = useState<LaudoSectionConfig[]>([]);
  const transcriptRef = useRef(transcript);
  const patientDataRef = useRef(patientData);

  // Auto-fill patient data from embedded bridge token
  useEffect(() => {
    if (isEmbedded && bridgeToken && !patientData?.nome_completo) {
      const initials = bridgeToken.patient_name
        .split(' ')
        .map((w: string) => w[0])
        .join('.')
        .toUpperCase();
      setPatientData((prev: any) => ({
        ...prev,
        iniciais: initials,
        nome_completo: bridgeToken.patient_name,
        sexo: bridgeToken.patient_gender === 'Masculino' ? 'M' : bridgeToken.patient_gender === 'Feminino' ? 'F' : 'Outro',
        idade: bridgeToken.patient_age?.toString() || '',
        medicacoes: bridgeToken.patient_medications ? bridgeToken.patient_medications.split(',').map(s => s.trim()).filter(Boolean) : [],
        alergias: bridgeToken.patient_allergies ? bridgeToken.patient_allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
        contexto_clinico: bridgeToken.patient_comorbidities || '',
      }));
    }
  }, [isEmbedded, bridgeToken]);

  // Handle "Finalizar e Enviar" for embedded/bridge mode
  const [isSendingToMindPEP, setIsSendingToMindPEP] = useState(false);
  const handleEmbeddedFinalize = useCallback(async () => {
    if (!laudo || !isEmbedded) return;
    setIsSendingToMindPEP(true);
    try {
      const payload = {
        documents: {
          laudo: {
            content: laudo.report_markdown || '',
            diagnosis: laudo.diagnosis_main || '',
            specialty: laudo.specialty || '',
          },
          receita: {
            content: '',
          },
          exames: (laudo.complementary_exams as any[]) || [],
          resumo: {
            content: (laudo.summary as any)?.text || laudo.report_markdown?.substring(0, 500) || '',
          },
        },
      };
      const success = await sendCompleted(payload);
      if (success) {
        toast({ title: 'Laudo enviado', description: 'Os dados foram salvos no prontuário MindPEP. Você pode fechar esta aba.' });
      } else {
        toast({ title: 'Erro ao enviar', description: 'Não foi possível salvar no MindPEP. Tente novamente.', variant: 'destructive' });
      }
    } finally {
      setIsSendingToMindPEP(false);
    }
  }, [laudo, isEmbedded, sendCompleted, toast]);

  // Show bridge error
  useEffect(() => {
    if (bridgeError) {
      toast({ title: 'Erro de integração', description: bridgeError, variant: 'destructive' });
    }
  }, [bridgeError]);

  // Load doctor's specialty from profile
  useEffect(() => {
    if (user && !selectedSpecialty) {
      supabase.from('profiles').select('specialty').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.specialty) setSelectedSpecialty(data.specialty);
          else setSelectedSpecialty('clinica_geral');
        });
    }
  }, [user]);

  // Keep refs in sync to avoid stale closures in async callbacks
  const generationRetryCount = useRef(0);
  const lastGenerationAttemptAt = useRef(0);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { patientDataRef.current = patientData; }, [patientData]);

  // ===== POLLING-BASED STATUS TRACKING (Realtime disabled for PHI security) =====
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const syncPipelineStageFromLaudo = useCallback((snapshot: any) => {
    if (!snapshot) return;

    if (snapshot.transcript_status === 'error' || snapshot.audio_processing_status === 'error' || snapshot.status === 'error') {
      setPipelineStage('error');
      setIsSubmitting(false);
      return;
    }

    if (snapshot.status === 'completed') {
      setPipelineStage('completed');
      setIsSubmitting(false);
      return;
    }

    if (snapshot.transcript_status === 'processing' || snapshot.audio_processing_status === 'processing') {
      setPipelineStage('transcribing');
      return;
    }

    if (snapshot.status === 'generating') {
      if (snapshot.last_update_type === 'structuring') {
        setPipelineStage('structuring');
        return;
      }
      if (snapshot.last_update_type === 'preparing') {
        setPipelineStage('preparing');
        return;
      }
      setPipelineStage('calling_ai');
      return;
    }

    if (isReadyToGenerate(snapshot)) {
      setPipelineStage('preparing');
    }
  }, []);

  // Direct generation call that bypasses state guards - used for auto-trigger
  const invokeGenerateLaudo = useCallback(async (transcriptText: string, currentLaudoId: string): Promise<boolean> => {
    try {
      const headers = await getCloudFunctionHeaders(session?.access_token);

      setPipelineStage('calling_ai');

      const { error } = await supabase.functions.invoke('generate-laudo', {
        body: {
          patient: {
            iniciais: patientDataRef.current?.iniciais || 'N/I',
            sexo: patientDataRef.current?.sexo || 'Não informado',
            idade: parseInt(patientDataRef.current?.idade) || 0,
          },
          specialty: patientDataRef.current?.especialidade || 'Não especificada',
          chief_complaint: patientDataRef.current?.queixa_principal || 'Não informada',
          transcript: transcriptText,
          vitals: patientDataRef.current?.sinais_vitais || {},
          meds: patientDataRef.current?.medicacoes || [],
          allergies: patientDataRef.current?.alergias || [],
          exam_findings: '',
          contexto_clinico: patientDataRef.current?.contexto_clinico || '',
          historico: patientDataRef.current?.historico || '',
          laudo_id: currentLaudoId,
          mode: 'fast',
          template_specialty: selectedSpecialty || undefined,
        },
        headers,
      });

      if (error) {
        console.error('generate-laudo invoke error:', error);
        // Retry up to 2 times
        if (generationRetryCount.current < 2) {
          generationRetryCount.current++;
          setTimeout(() => {
            void invokeGenerateLaudo(transcriptText, currentLaudoId);
          }, 2000);
        } else {
          hasTriggeredGeneration.current = false;
          setPipelineStage('error');
          setIsSubmitting(false);
          toast({ title: 'Erro ao gerar laudo', description: 'Tente novamente usando o botão abaixo', variant: 'destructive' });
        }
        return false;
      }

      return true;
    } catch (err: any) {
      console.error('generate-laudo exception:', err);
      if (generationRetryCount.current < 2) {
        generationRetryCount.current++;
        setTimeout(() => {
          void invokeGenerateLaudo(transcriptText, currentLaudoId);
        }, 2000);
      } else {
        hasTriggeredGeneration.current = false;
        setPipelineStage('error');
        setIsSubmitting(false);
        toast({ title: 'Erro ao gerar laudo', description: err.message || 'Erro inesperado', variant: 'destructive' });
      }
      return false;
    }
  }, [selectedSpecialty, session?.access_token, toast]);

  const handleLaudoUpdate = useCallback((updated: any) => {
    setLaudo(updated);

    // Update transcript
    if (updated.transcript?.text && updated.transcript.text !== transcriptRef.current) {
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

    syncPipelineStageFromLaudo(updated);

    if (updated.status === 'completed') {
      stopPolling();
      setPipelineStage('completed');
      if (!hasShownSuccessToast.current) {
        hasShownSuccessToast.current = true;
        toast({ title: 'Laudo gerado!', description: 'O laudo foi gerado com sucesso' });
        if (!updated.patient_id && !patientModalDismissedRef.current) {
          setShowPatientModal(true);
        } else {
          setPatientLinked(true);
        }

        // Check if this is the user's first laudo and send email
        (async () => {
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) return;
            const { count } = await supabase
              .from('laudos')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', currentUser.id)
              .eq('status', 'completed');
            if (count === 1) {
              setShowFirstLaudoSuccess(true);
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', currentUser.id)
                .maybeSingle();
              supabase.functions.invoke('send-transactional-email', {
                body: {
                  templateName: 'first-laudo',
                  recipientEmail: currentUser.email,
                  idempotencyKey: `first-laudo-${currentUser.id}`,
                  templateData: {
                    doctorName: profile?.full_name,
                    laudoTitle: updated.title,
                  },
                },
              }).catch(() => {});
            }
          } catch (_err) {
            }
        })();
      }
      setIsSubmitting(false);
    } else if (updated.transcript_status === 'error' || updated.audio_processing_status === 'error' || updated.status === 'error') {
      stopPolling();
    }

    // Auto-trigger generation when transcription completes
    if (shouldRetryDraftGeneration(updated, hasTriggeredGeneration.current, lastGenerationAttemptAt.current)) {
      hasTriggeredGeneration.current = true;
      generationRetryCount.current = 0;
      lastGenerationAttemptAt.current = Date.now();
      setPipelineStage('preparing');
      const currentId = laudoId || updated.id;
      if (currentId) {
        void invokeGenerateLaudo(updated.transcript.text, currentId).then((started) => {
          if (!started) {
            hasTriggeredGeneration.current = false;
          }
        });
      }
    }
  }, [toast, stopPolling, laudoId, invokeGenerateLaudo, syncPipelineStageFromLaudo]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollCountRef.current = 0;
    
    const poll = () => {
      pollCountRef.current++;
      if (pollCountRef.current > 90) {
        stopPolling();
        setPipelineStage('error');
        setIsSubmitting(false);
        toast({ title: 'Tempo esgotado', description: 'O processamento demorou demais. Tente novamente.', variant: 'destructive' });
        return;
      }

      Promise.resolve(
        supabase
          .from('laudos')
          .select('*')
          .eq('id', id)
          .single()
      ).then(({ data: updated }) => {
          if (updated) {
            handleLaudoUpdate(updated);
            if (pollingRef.current === null || isTerminalLaudoState(updated)) {
              return;
            }
          }
          if (pollingRef.current === null) return;
          pollingRef.current = setTimeout(poll, getPollingDelayMs(pollCountRef.current)) as any;
        })
        .catch(() => {
          if (pollingRef.current === null) return;
          pollingRef.current = setTimeout(poll, getPollingDelayMs(pollCountRef.current)) as any;
        });
    };
    
    // Start first poll faster (500ms instead of 1000ms)
    pollingRef.current = setTimeout(poll, 500) as any;
  }, [stopPolling, handleLaudoUpdate, toast]);

  const loadLaudoRef = useRef<((silent?: boolean) => Promise<any>) | null>(null);

  const loadLaudo = useCallback(async (silent = false) => {
    if (!laudoId) return null;

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

      syncPipelineStageFromLaudo(data);

      if (data.status === 'completed') {
        stopPolling();
        setPipelineStage('completed');
        setIsSubmitting(false);
        hasShownSuccessToast.current = true;
        setPatientLinked(!!data.patient_id);
        if (!data.patient_id && !patientModalDismissedRef.current) {
          setShowPatientModal(true);
        }
      } else if (isReadyToGenerate(data)) {
        setPipelineStage('preparing');
        if (!pollingRef.current) {
          startPolling(laudoId);
        }
        if (!hasTriggeredGeneration.current && transcriptData?.text) {
          hasTriggeredGeneration.current = true;
          generationRetryCount.current = 0;
          lastGenerationAttemptAt.current = Date.now();
          void invokeGenerateLaudo(transcriptData.text, laudoId).then((started) => {
            if (!started) {
              hasTriggeredGeneration.current = false;
            }
          });
        }
      } else if (data.status === 'generating') {
        if (!pollingRef.current) {
          startPolling(laudoId);
        }
      } else if (data.status === 'error' || data.transcript_status === 'error') {
        stopPolling();
        setPipelineStage('error');
        setIsSubmitting(false);
      } else if (data.transcript_status === 'processing' || data.audio_processing_status === 'processing') {
        setPipelineStage('transcribing');
        if (!pollingRef.current) {
          startPolling(laudoId);
        }
      }

      return data;
    } catch (error: any) {
      if (!silent) {
        toast({ title: 'Erro', description: 'Não foi possível carregar o laudo', variant: 'destructive' });
      }
      return null;
    }
  }, [invokeGenerateLaudo, laudoId, startPolling, stopPolling, toast, syncPipelineStageFromLaudo]);

  // Keep ref in sync so effects don't need loadLaudo in deps
  loadLaudoRef.current = loadLaudo;

  useEffect(() => {
    if (!laudoId) return;

    hasShownSuccessToast.current = false;
    hasTriggeredGeneration.current = false;
    patientModalDismissedRef.current = false;

    // Use ref to avoid loadLaudo in deps (prevents circular re-renders)
    loadLaudoRef.current?.(false);

    return () => {
      stopPolling();
    };
  }, [laudoId, stopPolling]);

  // Recovery watchdog — only fires when polling isn't active (safety net)
  useEffect(() => {
    if (!laudoId || ['idle', 'completed'].includes(pipelineStage) || laudo?.status === 'completed') return;
    if (pollingRef.current) return;

    const recoveryInterval = window.setInterval(() => {
      loadLaudoRef.current?.(true);
    }, 5000);

    return () => {
      window.clearInterval(recoveryInterval);
    };
  }, [pipelineStage, laudo?.status, laudoId]);

  const handleGenerateLaudo = useCallback(async (transcriptText?: string) => {
    if (!laudoId) return;
    
    const textToUse = transcriptText || transcript;
    if (!textToUse) {
      toast({ title: 'Atenção', description: 'Aguarde a transcrição ser concluída', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    generationRetryCount.current = 0;
    hasTriggeredGeneration.current = true;
    lastGenerationAttemptAt.current = Date.now();
    
    startPolling(laudoId);
    await invokeGenerateLaudo(textToUse, laudoId);
  }, [laudoId, transcript, toast, startPolling, invokeGenerateLaudo]);

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

      const headers = await getCloudFunctionHeaders(session?.access_token);

      startPolling(newLaudo.id);

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
          template_specialty: selectedSpecialty || undefined,
        },
        headers,
      });

      if (error) throw error;

      navigate(`/novo-laudo?id=${newLaudo.id}`, { replace: true });
    } catch (error: any) {
      setPipelineStage('error');
      setIsSubmitting(false);
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar laudo', variant: 'destructive' });
    }
  };

  const handleAudioUploadComplete = async (
    url: string,
    path: string,
    meta?: { blob?: Blob; durationSec?: number },
  ) => {
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

      navigate(`/novo-laudo?id=${newLaudo.id}`, { replace: true });

      const headers = await getCloudFunctionHeaders(session?.access_token);
      const audioBlob = meta?.blob;

      // Decide between chunked and single-shot pipeline. Chunked is used for
      // long consultations (>5 min) and parallelizes Whisper calls so a 1h+
      // recording finishes in a fraction of the time.
      let useChunking = false;
      if (audioBlob) {
        // If we have a duration hint from the recorder, use it; otherwise we
        // let the chunker probe and fall back if it's short.
        if (typeof meta?.durationSec === 'number') {
          useChunking = meta.durationSec > 300;
        } else {
          useChunking = true; // probe inside the hook will short-circuit if short
        }
      }

      if (useChunking && audioBlob) {
        toast({
          title: 'Áudio longo detectado',
          description: 'Processando em paralelo para acelerar a transcrição.',
        });

        // Start polling so the laudo refreshes after generate-laudo dispatch
        startPolling(newLaudo.id);

        try {
          const result = await chunkedTranscription.start({
            blob: audioBlob,
            laudoId: newLaudo.id,
            accessToken: session?.access_token,
            mode: 'complete',
          });

          // If the audio was short, fall back to the legacy single-shot path
          if (!result.chunked) {
            supabase.functions.invoke('transcribe-audio', {
              body: {
                audio_url: url,
                audio_path: path,
                laudo_id: newLaudo.id,
                mode: 'complete',
              },
              headers,
            }).catch(() => { /* polling surfaces errors */ });
          }
        } catch (err: any) {
          if (err?.message !== 'cancelled') {
            // Recover by trying the single-shot pipeline once
            supabase.functions.invoke('transcribe-audio', {
              body: {
                audio_url: url,
                audio_path: path,
                laudo_id: newLaudo.id,
                mode: 'complete',
              },
              headers,
            }).catch(() => { /* polling surfaces errors */ });
          }
        }
      } else {
        toast({ title: 'Processando áudio...', description: 'A transcrição e geração do laudo serão automáticas' });
        startPolling(newLaudo.id);

        supabase.functions.invoke('transcribe-audio', {
          body: {
            audio_url: url,
            audio_path: path,
            laudo_id: newLaudo.id,
            mode: 'complete',
          },
          headers,
        }).catch(() => { /* polling surfaces errors */ });
      }
    } catch (error: any) {
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
      hasTriggeredGeneration.current = false;
      lastGenerationAttemptAt.current = 0;
      
      const headers = await getCloudFunctionHeaders(session?.access_token);
      const sourceUrl = laudo?.source_audio_url;
      if (!sourceUrl) throw new Error('Áudio de origem não encontrado.');
      
      // Start polling before invoking
      startPolling(laudoId);
      
      const { error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio_url: sourceUrl, laudo_id: laudoId, mode: 'fast' },
        headers,
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

  const lastSavedPatientJson = useRef('');
  const handlePatientDataChange = useCallback(async (data: any) => {
    const merged = {
      ...data,
      nome_completo: data.nome_completo || patientDataRef.current?.nome_completo || '',
    };
    
    // Skip if data hasn't actually changed (prevents save loops)
    const json = JSON.stringify(merged);
    if (json === lastSavedPatientJson.current) return;
    lastSavedPatientJson.current = json;
    
    setPatientData(merged);
    
    if (laudoId) {
      try {
        await supabase
          .from('laudos')
          .update({ patient_data: merged })
          .eq('id', laudoId);
        
        setLaudo((prev: any) => prev ? { ...prev, patient_data: merged } : prev);
      } catch (err) {
      }
    }
  }, [laudoId]);

  // Regenerate laudo incorporating exam findings + original transcript
  const handleRegenerateWithExams = async (examSummary: string) => {
    if (!laudoId || isSubmitting) return;
    
    const textToUse = transcript || (laudo?.transcript as any)?.text || '';
    if (!textToUse) {
      toast({ title: 'Sem transcrição', description: 'Não há transcrição disponível para regenerar o laudo', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    setPipelineStage('preparing');
    hasShownSuccessToast.current = false;
    hasTriggeredGeneration.current = true;
    lastGenerationAttemptAt.current = Date.now();

    try {
      // Reset laudo status so generate-laudo can claim it
      await supabase
        .from('laudos')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', laudoId);

      setPipelineStage('calling_ai');
      
      const headers = await getCloudFunctionHeaders(session?.access_token);

      startPolling(laudoId);

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
          exam_findings: examSummary,
          contexto_clinico: patientData?.contexto_clinico || '',
          historico: patientData?.historico || '',
          laudo_id: laudoId,
          mode: 'complete',
          template_specialty: selectedSpecialty || undefined,
        },
        headers,
      });

      if (error) throw error;
      
      toast({ title: 'Regenerando laudo...', description: 'A IA está analisando os exames junto com a consulta original' });
    } catch (error: any) {
      setPipelineStage('error');
      setIsSubmitting(false);
      toast({ title: 'Erro', description: error.message || 'Erro ao regenerar laudo', variant: 'destructive' });
    }
  };

  // Map pipeline stage to SmartProgress stage
  const getSmartStage = (): SmartStage => {
    switch (pipelineStage) {
      case 'uploading': return 'uploading';
      case 'transcribing': return 'transcribing';
      case 'preparing': return 'organizing';
      case 'calling_ai': return 'diagnosing';
      case 'structuring': 
      case 'saving': return 'structuring';
      case 'completed': return 'completed';
      case 'error': return 'error';
      default: return 'uploading';
    }
  };

  const isProcessing = !['idle', 'completed'].includes(pipelineStage);

  // If no laudo exists yet, show the input mode selector
  if (!laudoId) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            {!isEmbedded && (
              <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Dashboard
              </Button>
            )}
            {isEmbedded && bridgeToken && (
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline" className="text-sm">
                  MindPEP • {bridgeToken.patient_name}
                </Badge>
                <Button variant="ghost" size="sm" onClick={sendCancelled}>
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              </div>
            )}
            <h1 className="text-3xl font-bold">Novo Laudo com IA</h1>
            <p className="text-muted-foreground mt-2">
              Escolha como deseja criar o laudo: gravando áudio ou digitando texto
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              {/* Specialty Selector */}
              <Card>
                <CardContent className="pt-4">
                  <Label className="flex items-center gap-2 mb-2">
                    <Stethoscope className="w-4 h-4 text-primary" />
                    Tipo de consulta
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select value={selectedSpecialty || 'clinica_geral'} onValueChange={setSelectedSpecialty}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {specialtyTemplates.map((t) => (
                                <SelectItem key={t.specialty} value={t.specialty}>
                                  {t.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-medium mb-1">Seções geradas:</p>
                        <ul className="text-xs space-y-0.5">
                          {specialtyTemplates.find(t => t.specialty === (selectedSpecialty || 'clinica_geral'))?.sections
                            .sort((a, b) => a.order - b.order)
                            .map((s) => (
                              <li key={s.key}>• {s.label}</li>
                            ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardContent>
              </Card>

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

                      {chunkedTranscription.state.totalChunks > 0 && (
                        <div className="mt-4">
                          <TranscriptionStream state={chunkedTranscription.state} />
                        </div>
                      )}
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
    <>
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* ── Top Navigation ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {!isEmbedded ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Dashboard
              </Button>
            ) : bridgeToken && (
              <Badge variant="outline" className="text-sm">MindPEP • {bridgeToken.patient_name}</Badge>
            )}
            <span className="text-muted-foreground/40">|</span>
            <h1 className="text-lg font-bold text-foreground">
              {laudo?.status === 'completed' ? 'Laudo Médico' : 'Nova Consulta'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isEmbedded && laudo?.status === 'completed' && (
              <>
                <Button variant="ghost" size="sm" onClick={sendCancelled}><X className="w-4 h-4 mr-1" /> Fechar</Button>
                <Button size="sm" onClick={handleEmbeddedFinalize} disabled={isSendingToMindPEP}>
                  {isSendingToMindPEP ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Enviar ao MindPEP
                </Button>
              </>
            )}
            {!isEmbedded && laudo?.status === 'completed' && (
              <Button size="sm" onClick={() => { stopPolling(); setLaudoId(null); setLaudo(null); setTranscript(''); setPatientData(null); setPipelineStage('idle'); setIsSubmitting(false); setPatientLinked(false); hasShownSuccessToast.current = false; hasTriggeredGeneration.current = false; patientModalDismissedRef.current = false; navigate('/novo-laudo'); }} className="gap-1.5">
                <Mic className="w-4 h-4" /> Nova Consulta
              </Button>
            )}
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ── LEFT SIDEBAR ── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Specialty Selector */}
            {!laudo?.status || laudo.status !== 'completed' ? (
              <Card className="border-border/60">
                <CardContent className="pt-4 pb-3">
                  <Label className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Stethoscope className="w-3.5 h-3.5 text-primary" /> Tipo de consulta
                  </Label>
                  <Select value={selectedSpecialty || 'clinica_geral'} onValueChange={setSelectedSpecialty}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {specialtyTemplates.map((t) => (
                        <SelectItem key={t.specialty} value={t.specialty}>{t.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ) : laudo?.specialty && (
              <div className="flex items-center gap-2 px-1">
                <Stethoscope className="w-4 h-4 text-primary" />
                <Badge variant="secondary" className="text-xs">
                  {specialtyTemplates.find(t => t.specialty === laudo.specialty)?.display_name || laudo.specialty}
                </Badge>
              </div>
            )}

            <PatientDataForm initialData={patientData} onDataChange={handlePatientDataChange} autoSave={true} />

            {/* Transcript Card */}
            <Card className="border-border/60">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Transcrição
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <Textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={8}
                  className="text-sm resize-none"
                  placeholder={pipelineStage === 'transcribing' ? "Transcrevendo..." : "Transcrição aparecerá aqui"}
                  disabled={pipelineStage === 'transcribing'}
                />
                {transcript && pipelineStage !== 'transcribing' && laudo?.status !== 'completed' && laudo?.status !== 'generating' && (
                  <Button onClick={() => handleGenerateLaudo()} disabled={isSubmitting} className="w-full mt-3 h-9 text-sm">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</> : 'Gerar Laudo'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Template Config - only show when laudo is completed */}
            {laudo?.status === 'completed' && (
              <LaudoTemplateConfig onConfigChange={setLaudoTemplateSections} />
            )}
          </div>

          {/* ── RIGHT CONTENT ── */}
          <div className="lg:col-span-9">
            {laudo?.status === 'completed' ? (
              <>
              <Tabs defaultValue={showEditor ? "editor" : "viewer"} className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/50 rounded-xl p-1 mb-5">
                  <TabsTrigger value="viewer" onClick={() => setShowEditor(false)} className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Resumo
                  </TabsTrigger>
                  <TabsTrigger value="editor" onClick={() => setShowEditor(true)} className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Edit className="w-3.5 h-3.5" /> Laudo
                  </TabsTrigger>
                  <TabsTrigger value="exams" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Upload className="w-3.5 h-3.5" /> Exames
                  </TabsTrigger>
                  <TabsTrigger value="prescription" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Pill className="w-3.5 h-3.5" /> Receita
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="viewer" forceMount className="data-[state=inactive]:hidden">
                  <LaudoViewer laudoId={laudoId} refreshKey={laudoRefreshKey} visibleSections={laudoTemplateSections} laudoData={laudo} />
                </TabsContent>
                
                <TabsContent value="editor" forceMount className="data-[state=inactive]:hidden">
                  <LaudoEditor laudoId={laudoId} initialData={laudo} onStatusChange={(newStatus) => { setLaudo({ ...laudo, status: newStatus }); }} />
                </TabsContent>

                <TabsContent value="exams" forceMount className="data-[state=inactive]:hidden">
                  <ExamUploadSection
                    laudoId={laudoId}
                    patientId={laudo?.patient_id}
                    patientName={patientData?.iniciais || ''}
                    clinicalContext={typeof laudo?.clinical_context === 'string' ? laudo.clinical_context : (laudo?.clinical_context ? JSON.stringify(laudo.clinical_context) : '')}
                    transcriptText={typeof laudo?.transcript === 'string' ? laudo.transcript : (laudo?.transcript?.text || '')}
                    onExamsAnalyzed={() => { toast({ title: "Exames integrados", description: "Seção de exames complementares atualizada" }); loadLaudoRef.current?.(); }}
                    onRegenerateWithExams={handleRegenerateWithExams}
                  />
                </TabsContent>

                <TabsContent value="prescription" forceMount className="data-[state=inactive]:hidden">
                  <PrescriptionTab laudoData={laudo} patientData={patientData} />
                </TabsContent>
              </Tabs>
            </>
            ) : isProcessing ? (
              <SmartProgress 
                stage={getSmartStage()} 
                onRetry={() => {
                  // If stuck at generation phase, retry generation instead of transcription
                  if (pipelineStage === 'preparing' || pipelineStage === 'calling_ai' || pipelineStage === 'structuring') {
                    const text = transcript || (laudo?.transcript as any)?.text;
                    if (text && laudoId) {
                      hasTriggeredGeneration.current = false;
                      generationRetryCount.current = 0;
                      setPipelineStage('preparing');
                      setIsSubmitting(true);
                      invokeGenerateLaudo(text, laudoId);
                      startPolling(laudoId);
                    }
                  } else {
                    retryTranscription();
                  }
                }} 
                isRetrying={isSubmitting} 
              />
            ) : (
              <Card className="border-border/60">
                <CardContent className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Stethoscope className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">Preencha os dados e clique em "Gerar Laudo"</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Patient Linking Modal */}
        {laudoId && (
          <PatientLinkingModal
            open={showPatientModal}
            laudoId={laudoId}
            extractedData={laudo?.patient_data ? {
              medicacoes: laudo.patient_data.medicacoes || [],
              alergias: laudo.patient_data.alergias || [],
              comorbidades: laudo.patient_data.comorbidades || [],
              queixa_principal: laudo.patient_data.queixa_principal || laudo.clinical_context?.chief_complaint || '',
              historico: laudo.patient_data.historico || '',
              historico_familiar: laudo.patient_data.historico_familiar || null,
              tabagismo: laudo.patient_data.tabagismo ?? null,
              etilismo: laudo.patient_data.etilismo ?? null,
              observacoes_clinicas: laudo.patient_data.observacoes_clinicas || null,
            } : undefined}
            onPatientLinked={(patientId, patientName) => {
              setShowPatientModal(false);
              patientModalDismissedRef.current = true;
              setPatientLinked(true);
              const initials = patientName.split(' ').map((w: string) => w[0]).join('.').toUpperCase();
              setLaudo((prev: any) => prev ? { 
                ...prev, 
                patient_id: patientId,
                patient_data: {
                  ...prev.patient_data,
                  nome_completo: patientName,
                  iniciais: initials,
                },
              } : prev);
              setPatientData((prev: any) => ({
                ...prev,
                iniciais: initials,
                nome_completo: patientName,
              }));
              setLaudoRefreshKey(k => k + 1);
              // Delay loadLaudo to let DB propagate
              setTimeout(() => loadLaudoRef.current?.(), 500);
            }}
            onSkip={() => {
              setShowPatientModal(false);
              patientModalDismissedRef.current = true;
            }}
          />
        )}
      </div>
    </div>
    <FirstLaudoSuccess
      open={showFirstLaudoSuccess}
      onClose={() => setShowFirstLaudoSuccess(false)}
      onUpgrade={() => {
        setShowFirstLaudoSuccess(false);
        navigate("/precos");
      }}
    />
    <MindChatWidget
      context={{
        patientName: patientData?.nome_completo || patientData?.iniciais,
        patientAge: patientData?.idade,
        patientSex: patientData?.sexo,
        chiefComplaint: patientData?.queixa_principal || (laudo?.clinical_context as any)?.chief_complaint,
        transcript: transcript || (laudo?.transcript as any)?.text,
        diagnosisMain: laudo?.diagnosis_main,
        diagnosisDiff: laudo?.diagnosis_diff,
        hypotheses: Array.isArray(laudo?.hypotheses) ? (laudo.hypotheses as any[]).map((h: any) => typeof h === 'string' ? h : h?.text || h?.title || '') : undefined,
        redFlags: Array.isArray(laudo?.red_flags) ? (laudo.red_flags as any[]).map((r: any) => typeof r === 'string' ? r : r?.text || r?.description || '') : undefined,
        cid10: Array.isArray(laudo?.cid10_codes) ? (laudo.cid10_codes as any[]).map((c: any) => typeof c === 'string' ? c : `${c?.code} - ${c?.description}`) : undefined,
        medications: patientData?.medicacoes,
        allergies: patientData?.alergias,
        comorbidities: patientData?.comorbidades || (patientData?.contexto_clinico ? [patientData.contexto_clinico] : undefined),
      }}
    />
    </>
  );
};

export default NovoLaudo;