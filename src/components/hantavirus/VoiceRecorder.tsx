import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";

interface Props {
  onTranscription: (text: string) => void;
  transcribe: (blob: Blob) => Promise<string>;
  disabled?: boolean;
}

export function VoiceRecorder({ onTranscription, transcribe, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const text = await transcribe(blob);
          if (text) onTranscription(text);
        } catch (e) {
          console.error(e);
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 60) { stop(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      console.error("Mic error:", e);
    }
  };

  const stop = () => {
    recRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3">
      {!recording && !transcribing && (
        <Button type="button" variant="outline" onClick={start} disabled={disabled}>
          <Mic className="w-4 h-4 mr-2 text-red-500" /> Gravar voz
        </Button>
      )}
      {recording && (
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping" />
            <span className="relative block w-3 h-3 rounded-full bg-red-500" />
          </div>
          <span className="text-sm font-mono">{fmt(seconds)}</span>
          <Button type="button" variant="destructive" size="sm" onClick={stop}>
            <Square className="w-4 h-4 mr-2" /> Parar
          </Button>
        </div>
      )}
      {transcribing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Transcrevendo...
        </div>
      )}
    </div>
  );
}
