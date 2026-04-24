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

export type ChunkStatus = "pending" | "uploading" | "transcribing" | "done" | "error";

export interface ChunkProgress {
  index: number;
  startSec: number;
  endSec: number;
  status: ChunkStatus;
  text?: string;
  error?: string;
}

export interface ChunkedTranscriptionState {
  isRunning: boolean;
  totalChunks: number;
  completedChunks: number;
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
}

interface StartResult {
  chunked: boolean;
  text?: string;
  durationSec?: number;
  segments?: Array<{ text: string; start: number; end: number; confidence: number }>;
}

const DEFAULT_THRESHOLD = 300;       // 5 min — under this, single-shot is fine
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_CHUNK_SECONDS = 300;

export function useChunkedTranscription() {
  const [state, setState] = useState<ChunkedTranscriptionState>({
    isRunning: false,
    totalChunks: 0,
    completedChunks: 0,
    durationSec: 0,
    partialText: "",
    chunks: [],
    error: null,
  });

  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setState({
      isRunning: false,
      totalChunks: 0,
      completedChunks: 0,
      durationSec: 0,
      partialText: "",
      chunks: [],
      error: null,
    });
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const updateChunk = useCallback((index: number, patch: Partial<ChunkProgress>) => {
    setState((prev) => {
      const nextChunks = prev.chunks.map((c) => (c.index === index ? { ...c, ...patch } : c));
      // Rebuild partial text from completed chunks in order
      const partialText = nextChunks
        .filter((c) => c.status === "done" && c.text)
        .map((c) => c.text!.trim())
        .join(" ")
        .trim();
      const completedChunks = nextChunks.filter((c) => c.status === "done").length;
      return { ...prev, chunks: nextChunks, partialText, completedChunks };
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
    } = args;

    cancelledRef.current = false;

    // 1. Probe duration. If the audio is short, signal the caller to use the
    //    legacy single-shot path — chunking has fixed decode overhead and isn't
    //    worth it for ~5 min audios.
    let duration = 0;
    try {
      duration = await probeAudioDuration(blob);
    } catch {
      duration = 0;
    }

    if (duration > 0 && !shouldChunkAudio(duration, chunkThresholdSec)) {
      return { chunked: false, durationSec: duration };
    }

    setState((prev) => ({ ...prev, isRunning: true, error: null, durationSec: duration }));

    // 2. Decode + slice in browser
    let chunks: AudioChunk[];
    try {
      chunks = await chunkAudioBlob(blob, { chunkSeconds });
    } catch (err: any) {
      const message = err?.message || "Falha ao dividir o áudio";
      setState((prev) => ({ ...prev, isRunning: false, error: message }));
      throw new Error(message);
    }

    if (cancelledRef.current) {
      setState((prev) => ({ ...prev, isRunning: false }));
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

    // 3. Transcribe chunks in parallel (bounded concurrency) and collect results
    interface ChunkResult {
      chunk_index: number;
      start_sec: number;
      text: string;
      segments: Array<{ text: string; start: number; end: number; confidence: number }>;
    }

    const results = await runWithConcurrency<AudioChunk, ChunkResult>(
      chunks,
      concurrency,
      async (chunk) => {
        if (cancelledRef.current) {
          throw new Error("cancelled");
        }

        updateChunk(chunk.index, { status: "uploading" });

        const form = new FormData();
        form.append("file", chunk.blob, `chunk-${chunk.index}.wav`);
        form.append("chunk_index", String(chunk.index));
        form.append("start_sec", String(chunk.startSec));
        form.append("laudo_id", laudoId);

        updateChunk(chunk.index, { status: "transcribing" });

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const url = `https://${projectId}.supabase.co/functions/v1/transcribe-chunk`;

        let lastError: any = null;
        // Retry once on transient failure
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const resp = await fetch(url, {
              method: "POST",
              headers: { ...headers },
              body: form,
            });
            if (!resp.ok) {
              const text = await resp.text();
              throw new Error(`chunk ${chunk.index} HTTP ${resp.status}: ${text.slice(0, 120)}`);
            }
            const data = await resp.json();
            updateChunk(chunk.index, { status: "done", text: data.text });
            return data as ChunkResult;
          } catch (err: any) {
            lastError = err;
            if (attempt === 0 && !cancelledRef.current) {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            updateChunk(chunk.index, { status: "error", error: err?.message || "erro" });
            throw err;
          }
        }
        throw lastError;
      },
    );

    if (cancelledRef.current) {
      setState((prev) => ({ ...prev, isRunning: false }));
      throw new Error("cancelled");
    }

    // 4. Merge transcripts in order
    const ordered = [...results].sort((a, b) => a.chunk_index - b.chunk_index);
    const fullText = ordered.map((r) => (r.text || "").trim()).filter(Boolean).join(" ").trim();
    const allSegments = ordered.flatMap((r) => r.segments || []);
    const totalDuration = duration || chunks.reduce((acc, c) => acc + c.durationSec, 0);

    // 5. Commit to backend (writes transcript + dispatches generate-laudo)
    const { error: finalizeErr } = await supabase.functions.invoke("finalize-transcription", {
      body: {
        laudo_id: laudoId,
        text: fullText,
        segments: allSegments,
        duration: totalDuration,
        mode,
        language: "pt",
      },
      headers,
    });

    if (finalizeErr) {
      const message = finalizeErr.message || "Falha ao finalizar transcrição";
      setState((prev) => ({ ...prev, isRunning: false, error: message }));
      throw new Error(message);
    }

    setState((prev) => ({ ...prev, isRunning: false }));

    return {
      chunked: true,
      text: fullText,
      durationSec: totalDuration,
      segments: allSegments,
    };
  }, [updateChunk]);

  return { state, start, cancel, reset };
}
