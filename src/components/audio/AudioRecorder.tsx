import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Square, Play, Pause } from "lucide-react";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import { useToast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  onRecordingComplete?: (url: string, path: string) => void;
}

export const AudioRecorder = ({ onRecordingComplete }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { uploadAudio, uploading } = useAudioUpload();
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 30 * 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error: any) {
      console.error('Recording error:', error);
      toast({
        title: "Erro ao gravar",
        description: "Não foi possível acessar o microfone",
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
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
      type: 'audio/webm',
    });

    const result = await uploadAudio(file);
    if (result) {
      onRecordingComplete?.(result.url, result.path);
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            {!isRecording && !audioBlob && (
              <Button
                onClick={startRecording}
                className="gradient-primary"
                size="lg"
              >
                <Mic className="w-5 h-5 mr-2" />
                Iniciar gravação
              </Button>
            )}

            {isRecording && (
              <>
                <Button
                  onClick={pauseRecording}
                  variant="outline"
                  size="lg"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Continuar
                    </>
                  ) : (
                    <>
                      <Pause className="w-5 h-5 mr-2" />
                      Pausar
                    </>
                  )}
                </Button>
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="lg"
                >
                  <Square className="w-5 h-5 mr-2" />
                  Parar
                </Button>
              </>
            )}
          </div>

          {isRecording && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full bg-destructive ${isPaused ? '' : 'animate-pulse'}`} />
                <span className="text-2xl font-mono font-bold">
                  {formatTime(recordingTime)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {isPaused ? 'Gravação pausada' : 'Gravando...'}
              </p>
            </div>
          )}

          {audioUrl && !isRecording && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm font-medium mb-2">
                  Gravação concluída: {formatTime(recordingTime)}
                </p>
                <audio
                  controls
                  src={audioUrl}
                  className="w-full"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setAudioBlob(null);
                    setAudioUrl(null);
                    setRecordingTime(0);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Descartar
                </Button>
                <Button
                  onClick={handleUpload}
                  className="flex-1 gradient-primary"
                  disabled={uploading}
                >
                  {uploading ? 'Enviando...' : 'Enviar para transcrição'}
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center">
            {!audioBlob && '💡 Clique para gravar sua consulta médica'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
