import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  chunkAudioBlob,
  probeAudioDuration,
  runWithConcurrency,
  shouldChunkAudio,
  type AudioChunk,
} from "@/lib/audio-chunker";
import { getCloudFunctionHeaders } from "@/lib/cloud-function-auth";

export type ChunkStatus = "pending" | "uploading" | "transcribing" | "summarizing" | "done" | "error";

export interface ChunkProgress {
  index: number;
  startSec: number;
  endSec: number;
  status: ChunkStatus;
  text?: string;
  summary?: any;
  error?: string;
}

export type PipelinePhase =
  | "idle"
  | "preparing"
  | "transcribing"
  | "summarizing"
  | "consolidating"
  | "done"
  | "error";

export interface ChunkedTranscriptionState {
  isRunning: boolean;
  phase: PipelinePhase;
  totalChunks: number;
  completedChunks: number;
  summarizedChunks: number;
  durationSec: number;
  partialText: string;       // assembled from completed chunks (in order)
  chunks: ChunkProgress[];
  error: string | null;
}

interface StartArgs {
  blob: Blob;
  laudoId: string;
  accessToken?: string;
  mode?: "fast" | "complete";
  /**
   * Below this threshold (in seconds) we skip chunking entirely and let the
   * caller fall back to the legacy single-shot transcribe-audio function.
   */
  chunkThresholdSec?: number;
  concurrency?: number;
  chunkSeconds?: number;
  /** When true, also summarize each chunk for map-reduce consolidation. */
  enableMapReduce?: boolean;
}

interface StartResult {
  chunked: boolean;
  text?: string;
  durationSec?: number;
  segments?: Array<{ text: string; start: number; end: number; confidence: number }>;
  summaries?: any[];
  consolidatedTranscript?: string;
}

const DEFAULT_THRESHOLD = 300;       // 5 min — under this, single-shot is fine
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_CHUNK_SECONDS = 300;
// Above this duration we trigger map-reduce summarization in addition to raw
// transcription, so the consolidator can build the laudo from condensed
// summaries instead of an oversized raw transcript.
const MAP_REDUCE_THRESHOLD_SEC = 25 * 60; // 25 min

const INITIAL_STATE: ChunkedTranscriptionState = {
  isRunning: false,
  phase: "idle",
  totalChunks: 0,
  completedChunks: 0,
  summarizedChunks: 0,
  durationSec: 0,
  partialText: "",
  chunks: [],
  error: null,
};

export function useChunkedTranscription() {
  const [state, setState] = useState<ChunkedTranscriptionState>(INITIAL_STATE);

  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setState(INITIAL_STATE);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const updateChunk = useCallback((index: number, patch: Partial<ChunkProgress>) => {
    setState((prev) => {
      const nextChunks = prev.chunks.map((c) => (c.index === index ? { ...c, ...patch } : c));
      // Rebuild partial text from completed chunks in order
      const partialText = nextChunks
        .filter((c) => (c.status === "done" || c.status === "summarizing") && c.text)
        .map((c) => c.text!.trim())
        .join(" ")
        .trim();
      const completedChunks = nextChunks.filter(
        (c) => c.status === "done" || c.status === "summarizing",
      ).length;
      const summarizedChunks = nextChunks.filter((c) => c.summary).length;
      return { ...prev, chunks: nextChunks, partialText, completedChunks, summarizedChunks };
    });
  }, []);

  const start = useCallback(async (args: StartArgs): Promise<StartResult> => {
    const {
      blob,
      laudoId,
      accessToken,
      mode = "complete",
      chunkThresholdSec = DEFAULT_THRESHOLD,
      concurrency = DEFAULT_CONCURRENCY,
      chunkSeconds = DEFAULT_CHUNK_SECONDS,
      enableMapReduce,
    } = args;

    cancelledRef.current = false;
    setState((prev) => ({ ...prev, phase: "preparing" }));

    let duration = 0;
    try {
      duration = await probeAudioDuration(blob);
    } catch {
      duration = 0;
    }

    // Whisper hard limit is 25 MB per request. We use 20 MB as the safe ceiling
    // so any larger upload ALWAYS goes through chunking, regardless of duration.
    const SAFE_SINGLE_SHOT_BYTES = 20 * 1024 * 1024; // 20 MB
    const exceedsSize = blob.size > SAFE_SINGLE_SHOT_BYTES;

    if (!exceedsSize && duration > 0 && !shouldChunkAudio(duration, chunkThresholdSec)) {
      setState((prev) => ({ ...prev, phase: "idle" }));
      return { chunked: false, durationSec: duration };
    }
    if (!exceedsSize && duration === 0 && blob.size <= 6 * 1024 * 1024) {
      // Small blob with unknown duration — safe to single-shot
      setState((prev) => ({ ...prev, phase: "idle" }));
      return { chunked: false, durationSec: 0 };
    }

    setState((prev) => ({
      ...prev,
      isRunning: true,
      error: null,
      durationSec: duration,
      phase: "transcribing",
    }));

    let chunks: AudioChunk[];
    try {
      chunks = await chunkAudioBlob(blob, { chunkSeconds });
    } catch (err: any) {
      const message = err?.message || "Falha ao dividir o áudio";
      setState((prev) => ({ ...prev, isRunning: false, error: message, phase: "error" }));
      throw new Error(message);
    }

    if (cancelledRef.current) {
      setState((prev) => ({ ...prev, isRunning: false, phase: "idle" }));
      throw new Error("cancelled");
    }

    setState((prev) => ({
      ...prev,
      totalChunks: chunks.length,
      durationSec: duration || chunks.reduce((acc, c) => acc + c.durationSec, 0),
      chunks: chunks.map((c) => ({
        index: c.index,
        startSec: c.startSec,
        endSec: c.endSec,
        status: "pending" as const,
      })),
    }));

    const headers = await getCloudFunctionHeaders(accessToken);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const transcribeUrl = `https://${projectId}.supabase.co/functions/v1/transcribe-chunk`;
    const summarizeUrl = `https://${projectId}.supabase.co/functions/v1/summarize-chunk`;

    const totalDuration = duration || chunks.reduce((acc, c) => acc + c.durationSec, 0);
    const useMapReduce = enableMapReduce ?? totalDuration >= MAP_REDUCE_THRESHOLD_SEC;

    interface ChunkResult {
      chunk_index: number;
      start_sec: number;
      text: string;
      segments: Array<{ text: string; start: number; end: number; confidence: number }>;
      summary?: any;
    }

    // Transcribe + (optionally) summarize each chunk. Summarization runs as
    // soon as transcription returns, so the two pipelines overlap and we save
    // wall-clock time on long audios.
    const results = await runWithConcurrency<AudioChunk, ChunkResult>(
      chunks,
      concurrency,
      async (chunk) => {
        if (cancelledRef.current) throw new Error("cancelled");

        updateChunk(chunk.index, { status: "uploading" });

        const form = new FormData();
        form.append("file", chunk.blob, `chunk-${chunk.index}.wav`);
        form.append("chunk_index", String(chunk.index));
        form.append("start_sec", String(chunk.startSec));
        form.append("laudo_id", laudoId);

        updateChunk(chunk.index, { status: "transcribing" });

        // Retry up to 3 times with exponential backoff
        let lastError: any = null;
        let transcriptData: ChunkResult | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const resp = await fetch(transcribeUrl, {
              method: "POST",
              headers: { ...headers },
              body: form,
            });
            if (!resp.ok) {
              const text = await resp.text();
              throw new Error(`chunk ${chunk.index} HTTP ${resp.status}: ${text.slice(0, 120)}`);
            }
            transcriptData = (await resp.json()) as ChunkResult;
            break;
          } catch (err: any) {
            lastError = err;
            if (attempt < 2 && !cancelledRef.current) {
              await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
              continue;
            }
            updateChunk(chunk.index, { status: "error", error: err?.message || "erro" });
            throw err;
          }
        }
        if (!transcriptData) throw lastError;

        updateChunk(chunk.index, {
          status: useMapReduce ? "summarizing" : "done",
          text: transcriptData.text,
        });

        // Summarize in the background (best-effort — never blocks transcription)
        let summary: any = null;
        if (useMapReduce && transcriptData.text?.trim()) {
          try {
            const sresp = await fetch(summarizeUrl, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                text: transcriptData.text,
                chunk_index: chunk.index,
              }),
            });
            if (sresp.ok) {
              const sdata = await sresp.json();
              summary = sdata.summary;
            }
          } catch (e) {
            // Summary failure shouldn't block the pipeline — we still have raw text.
            console.warn(`summary failed for chunk ${chunk.index}`, e);
          }
        }

        updateChunk(chunk.index, { status: "done", summary });
        return { ...transcriptData, summary };
      },
    );

    if (cancelledRef.current) {
      setState((prev) => ({ ...prev, isRunning: false, phase: "idle" }));
      throw new Error("cancelled");
    }

    setState((prev) => ({ ...prev, phase: "consolidating" }));

    // Merge transcripts in order
    const ordered = [...results].sort((a, b) => a.chunk_index - b.chunk_index);
    const fullText = ordered.map((r) => (r.text || "").trim()).filter(Boolean).join(" ").trim();
    const allSegments = ordered.flatMap((r) => r.segments || []);
    const summaries = ordered.map((r) => r.summary).filter(Boolean);

    // For long audios, build a condensed payload from the per-chunk summaries.
    // The generate-laudo function will receive this in "long" mode and use it
    // as the working transcript instead of the raw 90-min text.
    let consolidatedTranscript: string | undefined;
    if (useMapReduce && summaries.length > 0) {
      const sections: string[] = [];
      sections.push(`# Resumo consolidado da consulta (${summaries.length} blocos de 5 min)`);
      summaries.forEach((s, i) => {
        sections.push(`\n## Bloco ${i + 1}`);
        if (s.topicos?.length) sections.push(`Tópicos: ${s.topicos.join("; ")}`);
        if (s.sintomas?.length) sections.push(`Sintomas: ${s.sintomas.join(", ")}`);
        if (s.medicacoes?.length) sections.push(`Medicações: ${s.medicacoes.join(", ")}`);
        if (s.alergias?.length) sections.push(`Alergias: ${s.alergias.join(", ")}`);
        if (s.comorbidades?.length) sections.push(`Comorbidades: ${s.comorbidades.join(", ")}`);
        if (s.achados_exame?.length) sections.push(`Exame físico: ${s.achados_exame.join("; ")}`);
        if (s.condutas_discutidas?.length) sections.push(`Condutas: ${s.condutas_discutidas.join("; ")}`);
        if (s.red_flags?.length) sections.push(`⚠️ Red flags: ${s.red_flags.join("; ")}`);
        if (s.observacoes) sections.push(`Obs: ${s.observacoes}`);
      });
      consolidatedTranscript = sections.join("\n");
    }

    const finalizePayload: any = {
      laudo_id: laudoId,
      text: fullText,
      segments: allSegments,
      duration: totalDuration,
      mode: useMapReduce ? "long" : mode,
      language: "pt",
    };
    if (consolidatedTranscript) {
      finalizePayload.consolidated_transcript = consolidatedTranscript;
      finalizePayload.summaries = summaries;
    }

    const { error: finalizeErr } = await supabase.functions.invoke("finalize-transcription", {
      body: finalizePayload,
      headers,
    });

    if (finalizeErr) {
      const message = finalizeErr.message || "Falha ao finalizar transcrição";
      setState((prev) => ({ ...prev, isRunning: false, error: message, phase: "error" }));
      throw new Error(message);
    }

    setState((prev) => ({ ...prev, isRunning: false, phase: "done" }));

    return {
      chunked: true,
      text: fullText,
      durationSec: totalDuration,
      segments: allSegments,
      summaries,
      consolidatedTranscript,
    };
  }, [updateChunk]);

  return { state, start, cancel, reset };
}
