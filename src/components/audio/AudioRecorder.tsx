import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Mic, Square, Play, Pause, Upload, Trash2, Volume2 } from "lucide-react";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import { useToast } from "@/hooks/use-toast";
import { AudioConsentDialog } from "@/components/consent/AudioConsentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuota } from "@/hooks/useQuota";

interface AudioRecorderProps {
  onRecordingComplete?: (url: string, path: string, meta?: { blob?: Blob; durationSec?: number }) => void;
}

export const AudioRecorder = ({ onRecordingComplete }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const { uploadAudio, uploading, progress } = useAudioUpload();
  const { toast } = useToast();
  const { consumeQuota } = useQuota();

  const MAX_RECORDING_TIME = 90 * 60; // 90 minutos (consultas longas hospitalares)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioUrl]);

  const updateAudioLevel = () => {
    if (analyserRef.current && isRecording && !isPaused) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255 * 100);
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  };

  const startRecording = async () => {
    try {
      // Verificar consentimento LGPD primeiro
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: consents } = await supabase
        .from('consent_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('consent_type', 'audio_processing')
        .order('accepted_at', { ascending: false })
        .limit(1);

      if (!consents || consents.length === 0) {
        setShowConsentDialog(true);
        return;
      }

      setHasConsent(true);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Setup audio analyser for visual feedback
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        setAudioLevel(0);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // Start audio level monitoring
      updateAudioLevel();

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            toast({
              title: "Limite atingido",
              description: "Gravação parada automaticamente após 90 minutos.",
            });
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      toast({
        title: "Gravação iniciada",
        description: "Fale claramente próximo ao microfone.",
      });

    } catch (error: any) {
      console.error('Recording error:', error);
      toast({
        title: "Erro ao gravar",
        description: error.name === 'NotAllowedError' 
          ? "Permissão de microfone negada. Verifique as configurações do navegador."
          : "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        updateAudioLevel();
        toast({ title: "Gravação retomada" });
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        setAudioLevel(0);
        toast({ title: "Gravação pausada" });
      }
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    // Verificar e consumir quota
    const allowed = await consumeQuota();
    if (!allowed) return;

    const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
      type: 'audio/webm',
    });

    const result = await uploadAudio(file);
    if (result) {
      onRecordingComplete?.(result.url, result.path, { blob: audioBlob, durationSec: recordingTime });
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    toast({ title: "Gravação descartada" });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (recordingTime / MAX_RECORDING_TIME) * 100;

  return (
    <>
      <AudioConsentDialog
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        onConsent={() => {
          setHasConsent(true);
          setShowConsentDialog(false);
          startRecording();
        }}
      />
      
      <Card className="shadow-lg border-2 border-primary/10">
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Estado: Pronto para gravar */}
            {!isRecording && !audioBlob && (
              <div className="text-center space-y-4">
                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-4 border-primary/30 hover:border-primary/50 transition-all">
                  <Button
                    onClick={startRecording}
                    size="lg"
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-xl"
                  >
                    <Mic className="w-12 h-12" />
                  </Button>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Clique para gravar</p>
                  <p className="text-sm text-muted-foreground">
                    Grave a consulta médica (até 90 minutos)
                  </p>
                </div>
              </div>
            )}

            {/* Estado: Gravando */}
            {isRecording && (
              <div className="space-y-6">
                {/* Visualização de áudio */}
                <div className="relative">
                  <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                    isPaused 
                      ? 'bg-muted border-4 border-muted-foreground/20' 
                      : 'bg-destructive/10 border-4 border-destructive animate-pulse'
                  }`}>
                    <div 
                      className="w-28 h-28 rounded-full bg-destructive/20 flex items-center justify-center transition-transform"
                      style={{ transform: `scale(${1 + audioLevel / 200})` }}
                    >
                      <div className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center">
                        <Volume2 className={`w-10 h-10 text-white ${!isPaused && 'animate-pulse'}`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timer */}
                <div className="text-center">
                  <p className="text-4xl font-mono font-bold text-foreground">
                    {formatTime(recordingTime)}
                  </p>
                  <p className={`text-sm font-medium ${isPaused ? 'text-muted-foreground' : 'text-destructive'}`}>
                    {isPaused ? '⏸️ Gravação pausada' : '🔴 Gravando...'}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <Progress value={progressPercentage} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {formatTime(MAX_RECORDING_TIME - recordingTime)} restantes
                  </p>
                </div>

                {/* Controles */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    onClick={pauseRecording}
                    variant="outline"
                    size="lg"
                    className="w-16 h-16 rounded-full"
                  >
                    {isPaused ? (
                      <Play className="w-7 h-7" />
                    ) : (
                      <Pause className="w-7 h-7" />
                    )}
                  </Button>
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="w-20 h-20 rounded-full shadow-lg"
                  >
                    <Square className="w-8 h-8" />
                  </Button>
                </div>
              </div>
            )}

            {/* Estado: Gravação concluída */}
            {audioUrl && !isRecording && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Mic className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-lg font-semibold">Gravação concluída</p>
                  <p className="text-sm text-muted-foreground">
                    Duração: {formatTime(recordingTime)}
                  </p>
                </div>
                
                <audio
                  controls
                  src={audioUrl}
                  className="w-full rounded-lg"
                />

                {/* Upload progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Enviando...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={discardRecording}
                    variant="outline"
                    size="lg"
                    disabled={uploading}
                    className="gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Descartar
                  </Button>
                  <Button
                    onClick={handleUpload}
                    size="lg"
                    disabled={uploading}
                    className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                  >
                    <Upload className="w-5 h-5" />
                    {uploading ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            )}

            {/* Dica */}
            {!audioBlob && !isRecording && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Dica:</strong> Posicione o microfone próximo ao paciente e fale claramente.
                  O áudio será transcrito automaticamente pela IA.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
