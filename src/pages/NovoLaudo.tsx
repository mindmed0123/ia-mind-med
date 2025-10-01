import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PatientDataForm } from "@/components/laudos/PatientDataForm";
import { LaudoViewer } from "@/components/laudos/LaudoViewer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
      .select('transcript_status, transcript, audio_processing_status, status')
      .eq('id', laudoId)
      .single();

    if (data) {
      setIsProcessing(data.transcript_status === 'processing' || data.audio_processing_status === 'processing');
      
      const transcriptData = data.transcript as any;
      if (transcriptData?.text && transcriptData.text !== transcript) {
        setTranscript(transcriptData.text);
        
        // Auto-generate laudo when transcription is ready and not already generated
        if (data.transcript_status === 'completed' && data.status !== 'completed') {
          handleGenerateLaudo(transcriptData.text);
        }
      }
      
      // Update laudo state
      if (data.status === 'completed') {
        setLaudo(data);
      }
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
          mode: 'complete',
        },
      });

      if (error) throw error;

      toast({
        title: 'Laudo gerado!',
        description: 'O laudo foi gerado com sucesso',
      });

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
                <LaudoViewer laudoId={laudoId} />
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
