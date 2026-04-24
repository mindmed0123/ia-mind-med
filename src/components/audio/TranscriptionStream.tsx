import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ChunkedTranscriptionState } from "@/hooks/useChunkedTranscription";

interface TranscriptionStreamProps {
  state: ChunkedTranscriptionState;
}

function formatTime(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptionStream({ state }: TranscriptionStreamProps) {
  const { totalChunks, completedChunks, summarizedChunks, durationSec, partialText, chunks, error, phase } = state;

  if (totalChunks === 0 && !partialText) return null;

  const progress = totalChunks > 0 ? Math.round((completedChunks / totalChunks) * 100) : 0;

  const phaseLabel: Record<string, string> = {
    idle: "Aguardando",
    preparing: "Preparando áudio…",
    transcribing: "🎙️ Transcrevendo blocos em paralelo",
    summarizing: "🧠 Resumindo blocos clinicamente",
    consolidating: "📋 Consolidando consulta longa…",
    done: "✅ Transcrição concluída",
    error: "Erro no processamento",
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {phaseLabel[phase] || "Processando"} — {completedChunks}/{totalChunks} blocos
            {summarizedChunks > 0 && ` · ${summarizedChunks} resumidos`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Áudio de {formatTime(durationSec)} dividido em {totalChunks} blocos de 5 min processados em paralelo
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-primary">{progress}%</p>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      {/* Per-chunk timeline */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
        {chunks.map((c) => (
          <div
            key={c.index}
            title={`Bloco ${c.index + 1}: ${formatTime(c.startSec)}–${formatTime(c.endSec)}\n${c.status}`}
            className={cn(
              "relative aspect-square rounded-md border flex items-center justify-center text-[10px] font-mono transition-colors",
              c.status === "pending" && "bg-muted/40 border-muted-foreground/10 text-muted-foreground",
              c.status === "uploading" && "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
              c.status === "transcribing" && "bg-primary/10 border-primary/40 text-primary",
              c.status === "summarizing" && "bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-300",
              c.status === "done" && "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-300",
              c.status === "error" && "bg-destructive/10 border-destructive/40 text-destructive",
            )}
          >
            {c.status === "done" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : c.status === "error" ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : c.status === "transcribing" || c.status === "uploading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Clock className="w-3 h-3 opacity-50" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {partialText && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Transcrição parcial — chegando ao vivo
          </p>
          <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap text-foreground">{partialText}</p>
            {completedChunks < totalChunks && (
              <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
