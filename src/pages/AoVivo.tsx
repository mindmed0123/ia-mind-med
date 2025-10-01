import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mic, Square } from 'lucide-react';
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { PatientDataForm } from '@/components/laudos/PatientDataForm';
import { RealtimeTranscription } from '@/components/laudos/RealtimeTranscription';
import { DynamicLaudoPreview } from '@/components/laudos/DynamicLaudoPreview';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AoVivo = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [laudoId, setLaudoId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [laudo, setLaudo] = useState<any>(null);
  const [patientData, setPatientData] = useState<any>(null);

  const handleStartRecording = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado',
          variant: 'destructive',
        });
        return;
      }

      // Create laudo
      const { data: newLaudo, error } = await supabase
        .from('laudos')
        .insert({
          user_id: user.id,
          title: `Atendimento ao vivo - ${new Date().toLocaleString('pt-BR')}`,
          status: 'draft',
          transcript_status: 'pending',
          audio_processing_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      setLaudoId(newLaudo.id);
      setLaudo(newLaudo);
      setIsRecording(true);

      toast({
        title: 'Gravação iniciada',
        description: 'O atendimento está sendo gravado',
      });
    } catch (error: any) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao iniciar gravação',
        variant: 'destructive',
      });
    }
  };

  const handleRecordingComplete = async (url: string, path: string) => {
    try {
      if (!laudoId) return;

      // Update laudo with audio
      await supabase
        .from('laudos')
        .update({
          source_audio_url: url,
          audio_processing_status: 'processing',
        })
        .eq('id', laudoId);

      // Start transcription
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio_url: url,
          laudo_id: laudoId,
          mode: 'complete',
        },
      });

      if (error) throw error;

      toast({
        title: 'Transcrição iniciada',
        description: 'O áudio está sendo processado',
      });

      // Reload laudo
      const { data: updatedLaudo } = await supabase
        .from('laudos')
        .select('*')
        .eq('id', laudoId)
        .single();

      if (updatedLaudo) {
        setLaudo(updatedLaudo);
      }
    } catch (error: any) {
      console.error('Error processing audio:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao processar áudio',
        variant: 'destructive',
      });
    }
  };

  const handlePatientDataChange = useCallback(async (data: any) => {
    setPatientData(data);
    
    if (!laudoId || !laudo?.transcript) return;

    try {
      // Generate/update laudo with delta
      const { error } = await supabase.functions.invoke('generate-laudo', {
        body: {
          patient: {
            iniciais: data.iniciais,
            sexo: data.sexo,
            idade: parseInt(data.idade) || 0,
          },
          specialty: data.especialidade,
          chief_complaint: data.queixa_principal,
          transcript: laudo.transcript.text,
          vitals: data.sinais_vitais,
          meds: data.medicacoes,
          allergies: data.alergias,
          exam_findings: '',
          contexto_clinico: data.contexto_clinico,
          historico: data.historico,
          laudo_id: laudoId,
          mode: 'delta',
        },
      });

      if (error) throw error;

      // Reload laudo
      const { data: updatedLaudo } = await supabase
        .from('laudos')
        .select('*')
        .eq('id', laudoId)
        .single();

      if (updatedLaudo) {
        setLaudo(updatedLaudo);
      }
    } catch (error: any) {
      console.error('Error updating laudo:', error);
    }
  }, [laudoId, laudo]);

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Atendimento ao Vivo</h1>
              <p className="text-muted-foreground mt-2">
                Grave a consulta e gere o laudo em tempo real
              </p>
            </div>
            {!isRecording ? (
              <Button onClick={handleStartRecording} size="lg">
                <Mic className="w-5 h-5 mr-2" />
                Iniciar Gravação
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => setIsRecording(false)} size="lg">
                <Square className="w-5 h-5 mr-2" />
                Parar Gravação
              </Button>
            )}
          </div>
        </div>

        {isRecording && laudoId && (
          <>
            <div className="mb-6">
              <AudioRecorder onRecordingComplete={handleRecordingComplete} />
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <PatientDataForm
                  initialData={patientData}
                  onDataChange={handlePatientDataChange}
                  autoSave={true}
                />
              </div>

              <div>
                <RealtimeTranscription laudoId={laudoId} />
              </div>

              <div>
                <DynamicLaudoPreview laudo={laudo} isUpdating={false} />
              </div>
            </div>
          </>
        )}

        {!isRecording && !laudoId && (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <Mic className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-semibold mb-2">Pronto para começar?</h2>
              <p className="text-muted-foreground mb-6">
                Clique em "Iniciar Gravação" para começar o atendimento
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AoVivo;
