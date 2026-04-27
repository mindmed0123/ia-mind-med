import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, Square, Play, Pause, Upload, Trash2, Volume2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import { useToast } from "@/hooks/use-toast";
import { AudioConsentDialog } from "@/components/consent/AudioConsentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuota } from "@/hooks/useQuota";
import {
  startPersistedRecording,
  persistChunk,
  finalizeRecording,
  clearRecording,
  getRecoverableRecording,
} from "@/lib/recording-persistence";

interface AudioRecorderProps {
  onRecordingComplete?: (url: string, path: string, meta?: { blob?: Blob; durationSec?: number }) => void;
}

const MAX_RECORDING_TIME = 120 * 60; // 120 minutos (2h)
const WARN_10_MIN = MAX_RECORDING_TIME - 10 * 60; // 110 min
const WARN_5_MIN = MAX_RECORDING_TIME - 5 * 60;   // 115 min
const WARN_1_MIN = MAX_RECORDING_TIME - 60;       // 119 min

export const AudioRecorder = ({ onRecordingComplete }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [reachedLimit, setReachedLimit] = useState(false);
  const [autoUploading, setAutoUploading] = useState(false);
  const [recoveryBlob, setRecoveryBlob] = useState<{ id: string; blob: Blob; durationSec: number } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const recordingIdRef = useRef<string | null>(null);
  const warnedRef = useRef<{ w10: boolean; w5: boolean; w1: boolean }>({ w10: false, w5: false, w1: false });
  const autoUploadTriggeredRef = useRef(false);

  const { uploadAudio, uploading, progress } = useAudioUpload();
  const { toast } = useToast();
  const { consumeQuota } = useQuota();

  // Recovery: ao montar, verifica se há gravação não finalizada
  useEffect(() => {
    (async () => {
      const rec = await getRecoverableRecording();
      if (rec && rec.durationSec >= 5) {
        setRecoveryBlob({ id: rec.id, blob: rec.blob, durationSec: rec.durationSec });
      }
    })();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioUrl]);

  // Aviso ao tentar fechar a aba durante a gravação
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Há uma gravação em andamento. Tem certeza que deseja sair?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording]);

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && !isPaused) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel((average / 255) * 100);
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isPaused]);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setAudioLevel(0);
  };

  const finishRecording = useCallback(
    async (auto = false) => {
      if (!mediaRecorderRef.current) return;
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.warn("stop recorder failed", e);
      }
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recordingIdRef.current) {
        await finalizeRecording(recordingIdRef.current);
      }
      if (auto) {
        setReachedLimit(true);
      }
    },
    [],
  );

  // Auto-upload quando limite é atingido
  const triggerAutoUpload = useCallback(
    async (blob: Blob, durationSec: number) => {
      if (autoUploadTriggeredRef.current) return;
      autoUploadTriggeredRef.current = true;
      setAutoUploading(true);
      toast({
        title: "Limite máximo de 120 minutos atingido",
        description: "Sua gravação foi salva com segurança e está sendo enviada automaticamente.",
      });
      try {
        const allowed = await consumeQuota();
        if (!allowed) {
          setAutoUploading(false);
          autoUploadTriggeredRef.current = false;
          return;
        }
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        const result = await uploadAudio(file);
        if (result) {
          if (recordingIdRef.current) await clearRecording(recordingIdRef.current);
          onRecordingComplete?.(result.url, result.path, { blob, durationSec });
          setAudioBlob(null);
          setAudioUrl(null);
          setRecordingTime(0);
          setReachedLimit(false);
        } else {
          // upload falhou — não apaga o áudio, deixa o usuário tentar de novo
          autoUploadTriggeredRef.current = false;
        }
      } catch (err: any) {
        console.error("auto-upload failed", err);
        toast({
          title: "Falha no envio automático",
          description: "Sua gravação está salva. Clique em 'Enviar' para tentar novamente.",
          variant: "destructive",
        });
        autoUploadTriggeredRef.current = false;
      } finally {
        setAutoUploading(false);
      }
    },
    [consumeQuota, uploadAudio, onRecordingComplete, toast],
  );

  const startRecording = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: consents } = await supabase
        .from("consent_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("consent_type", "audio_processing")
        .order("accepted_at", { ascending: false })
        .limit(1);

      if (!consents || consents.length === 0) {
        setShowConsentDialog(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      warnedRef.current = { w10: false, w5: false, w1: false };
      autoUploadTriggeredRef.current = false;
      setReachedLimit(false);

      // inicia persistência
      const recId = await startPersistedRecording(mimeType);
      recordingIdRef.current = recId;

      let currentDuration = 0;

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          // persistência incremental (best-effort)
          if (recordingIdRef.current) {
            persistChunk(recordingIdRef.current, e.data, currentDuration).catch(() => {});
          }
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        cleanupStream();

        // se foi parada por auto-limit, dispara upload automático
        if (autoUploadTriggeredRef.current === false && currentDuration >= MAX_RECORDING_TIME) {
          triggerAutoUpload(blob, currentDuration);
        }
      };

      mediaRecorder.onerror = (e: any) => {
        console.error("MediaRecorder error", e);
        toast({
          title: "Erro durante a gravação",
          description: "Sua gravação parcial está salva. Tentando recuperar...",
          variant: "destructive",
        });
      };

      // chunks de 1s para autosave granular
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      updateAudioLevel();

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          currentDuration = next;

          // alertas progressivos
          if (next === WARN_10_MIN && !warnedRef.current.w10) {
            warnedRef.current.w10 = true;
            toast({
              title: "Atenção",
              description: "Faltam 10 minutos para o limite máximo de gravação.",
            });
          }
          if (next === WARN_5_MIN && !warnedRef.current.w5) {
            warnedRef.current.w5 = true;
            toast({
              title: "Atenção",
              description: "Faltam 5 minutos para o limite máximo de gravação.",
            });
          }
          if (next === WARN_1_MIN && !warnedRef.current.w1) {
            warnedRef.current.w1 = true;
            toast({
              title: "Atenção",
              description: "A gravação será finalizada automaticamente em 1 minuto.",
              variant: "destructive",
            });
          }

          if (next >= MAX_RECORDING_TIME) {
            // finaliza automaticamente — onstop dispara o auto-upload
            finishRecording(true);
            return MAX_RECORDING_TIME;
          }
          return next;
        });
      }, 1000);

      toast({
        title: "Gravação iniciada",
        description: "Sua gravação está sendo salva automaticamente a cada segundo.",
      });
    } catch (error: any) {
      console.error("Recording error:", error);
      toast({
        title: "Erro ao gravar",
        description:
          error.name === "NotAllowedError"
            ? "Permissão de microfone negada. Verifique as configurações do navegador."
            : "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    finishRecording(false);
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      updateAudioLevel();
      toast({ title: "Gravação retomada" });
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setAudioLevel(0);
      toast({ title: "Gravação pausada" });
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    const allowed = await consumeQuota();
    if (!allowed) return;

    const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
    const result = await uploadAudio(file);
    if (result) {
      if (recordingIdRef.current) await clearRecording(recordingIdRef.current);
      onRecordingComplete?.(result.url, result.path, { blob: audioBlob, durationSec: recordingTime });
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
      setReachedLimit(false);
    }
  };

  const discardRecording = async () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (recordingIdRef.current) await clearRecording(recordingIdRef.current);
    recordingIdRef.current = null;
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setReachedLimit(false);
    autoUploadTriggeredRef.current = false;
    toast({ title: "Gravação descartada" });
  };

  const recoverRecording = async () => {
    if (!recoveryBlob) return;
    const url = URL.createObjectURL(recoveryBlob.blob);
    setAudioBlob(recoveryBlob.blob);
    setAudioUrl(url);
    setRecordingTime(recoveryBlob.durationSec);
    recordingIdRef.current = recoveryBlob.id;
    setRecoveryBlob(null);
    toast({
      title: "Gravação recuperada",
      description: `Áudio de ${Math.floor(recoveryBlob.durationSec / 60)}min recuperado com sucesso.`,
    });
  };

  const dismissRecovery = async () => {
    if (recoveryBlob) await clearRecording(recoveryBlob.id);
    setRecoveryBlob(null);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercentage = (recordingTime / MAX_RECORDING_TIME) * 100;
  const isNearLimit = recordingTime >= WARN_10_MIN;
  const isCritical = recordingTime >= WARN_1_MIN;

  return (
    <>
      <AudioConsentDialog
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        onConsent={() => {
          setShowConsentDialog(false);
          startRecording();
        }}
      />

      <Card className="shadow-lg border-2 border-primary/10">
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Banner de recuperação */}
            {recoveryBlob && !isRecording && !audioBlob && (
              <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                <AlertDescription className="space-y-2">
                  <p className="text-sm font-medium">
                    Encontramos uma gravação anterior não enviada ({Math.floor(recoveryBlob.durationSec / 60)}min{" "}
                    {recoveryBlob.durationSec % 60}s).
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={recoverRecording}>
                      Recuperar
                    </Button>
                    <Button size="sm" variant="outline" onClick={dismissRecovery}>
                      Descartar
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Banner: limite atingido */}
            {reachedLimit && (autoUploading || uploading) && (
              <Alert className="border-primary/40 bg-primary/5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  Limite máximo de 120 minutos atingido. Sua gravação foi salva com segurança e está sendo processada
                  automaticamente para geração do laudo.
                </AlertDescription>
              </Alert>
            )}

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
                    Grave a consulta médica (até 2 horas / 120 minutos)
                  </p>
                </div>
              </div>
            )}

            {/* Estado: Gravando */}
            {isRecording && (
              <div className="space-y-6">
                <div className="relative">
                  <div
                    className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                      isPaused
                        ? "bg-muted border-4 border-muted-foreground/20"
                        : isCritical
                        ? "bg-destructive/20 border-4 border-destructive animate-pulse"
                        : "bg-destructive/10 border-4 border-destructive animate-pulse"
                    }`}
                  >
                    <div
                      className="w-28 h-28 rounded-full bg-destructive/20 flex items-center justify-center transition-transform"
                      style={{ transform: `scale(${1 + audioLevel / 200})` }}
                    >
                      <div className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center">
                        <Volume2 className={`w-10 h-10 text-white ${!isPaused && "animate-pulse"}`} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-4xl font-mono font-bold text-foreground">{formatTime(recordingTime)}</p>
                  <p className={`text-sm font-medium ${isPaused ? "text-muted-foreground" : "text-destructive"}`}>
                    {isPaused ? "⏸️ Gravação pausada" : "🔴 Gravando..."}
                  </p>
                </div>

                <div className="space-y-1">
                  <Progress value={progressPercentage} className={`h-2 ${isCritical ? "[&>div]:bg-destructive" : ""}`} />
                  <p className={`text-xs text-right ${isNearLimit ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {formatTime(MAX_RECORDING_TIME - recordingTime)} restantes (limite 2h)
                  </p>
                </div>

                {isNearLimit && (
                  <Alert variant={isCritical ? "destructive" : "default"} className={isCritical ? "" : "border-amber-500/40"}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {isCritical
                        ? "A gravação será finalizada automaticamente e enviada para processamento em breve."
                        : "Aproximando-se do limite máximo de 120 minutos. A gravação será encerrada e enviada automaticamente."}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-center gap-4">
                  <Button onClick={pauseRecording} variant="outline" size="lg" className="w-16 h-16 rounded-full">
                    {isPaused ? <Play className="w-7 h-7" /> : <Pause className="w-7 h-7" />}
                  </Button>
                  <Button onClick={stopRecording} variant="destructive" size="lg" className="w-20 h-20 rounded-full shadow-lg">
                    <Square className="w-8 h-8" />
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  💾 Áudio salvo automaticamente — protegido contra fechamento acidental
                </p>
              </div>
            )}

            {/* Estado: Gravação concluída */}
            {audioUrl && !isRecording && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Mic className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-lg font-semibold">
                    {reachedLimit ? "Gravação finalizada (limite atingido)" : "Gravação concluída"}
                  </p>
                  <p className="text-sm text-muted-foreground">Duração: {formatTime(recordingTime)}</p>
                </div>

                <audio controls src={audioUrl} className="w-full rounded-lg" />

                {(uploading || autoUploading) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{autoUploading ? "Enviando automaticamente..." : "Enviando..."}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {!reachedLimit && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={discardRecording} variant="outline" size="lg" disabled={uploading || autoUploading} className="gap-2">
                      <Trash2 className="w-5 h-5" />
                      Descartar
                    </Button>
                    <Button
                      onClick={handleUpload}
                      size="lg"
                      disabled={uploading || autoUploading}
                      className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                    >
                      <Upload className="w-5 h-5" />
                      {uploading ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                )}

                {reachedLimit && !uploading && !autoUploading && (
                  <Button onClick={handleUpload} size="lg" className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80">
                    <Upload className="w-5 h-5" />
                    Tentar enviar novamente
                  </Button>
                )}
              </div>
            )}

            {!audioBlob && !isRecording && !recoveryBlob && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Dica:</strong> Posicione o microfone próximo ao paciente e fale claramente. Sua gravação é
                  salva automaticamente — mesmo se a aba fechar.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
