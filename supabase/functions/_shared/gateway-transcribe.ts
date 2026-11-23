// Speech-to-text through the Lovable AI Gateway (billed to workspace credits).
// Shared by transcribe-audio (single shot) and transcribe-chunk (chunked).
import {
  GatewayError,
  PaymentRequiredError,
  RateLimitError,
  transcribeAudio,
} from "npm:@lovable.dev/ai-gateway@0.1.13";
import {
  CLINICAL_WHISPER_PROMPT_PT_BR,
  cleanClinicalTranscript,
  type CleanedSegment,
} from "./clinical-transcription.ts";

export const TRANSCRIPTION_MODEL = "openai/gpt-transcribe";

// Phrases speech models emit on silence/noise; a transcript made only of
// these is treated as empty.
const SILENCE_ARTIFACTS = [
  "obrigado por assistir",
  "obrigado por assistirem",
  "inscreva-se no canal",
  "legendas pela comunidade",
  "legendado por",
  "amara.org",
  "thanks for watching",
];

export class TranscriptionError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

export interface GatewayTranscript {
  text: string;
  durationSec: number;
  language: string;
  segments: CleanedSegment[];
}

/**
 * Transcribes one audio blob. `startOffsetSec` shifts the returned segment so
 * chunk results can be merged in order.
 */
export async function transcribeClinicalAudio(
  file: Blob,
  startOffsetSec = 0,
): Promise<GatewayTranscript> {
  let result: Awaited<ReturnType<typeof transcribeAudio<typeof TRANSCRIPTION_MODEL>>>;
  try {
    result = await transcribeAudio({
      model: TRANSCRIPTION_MODEL,
      file,
      language: "pt",
      response_format: "json",
      temperature: 0,
      prompt: CLINICAL_WHISPER_PROMPT_PT_BR,
    });
  } catch (err) {
    if (err instanceof PaymentRequiredError) {
      throw new TranscriptionError(402, "Créditos de IA esgotados. Recarregue os créditos do workspace.", "credits_exhausted");
    }
    if (err instanceof RateLimitError) {
      throw new TranscriptionError(429, "Muitas transcrições ao mesmo tempo. Tente novamente em instantes.", "rate_limited");
    }
    if (err instanceof GatewayError) {
      console.log(JSON.stringify({ fn: "gateway-transcribe", step: "gateway_error", code: err.code, status: err.httpStatus, ids: err.ids }));
      throw new TranscriptionError(502, "Serviço de transcrição indisponível no momento.", "gateway_error");
    }
    throw err;
  }

  const raw = typeof result === "string" ? result : result.text ?? "";
  const usage = typeof result === "string" ? undefined : result.usage;
  const durationSec = usage && usage.type === "duration" ? usage.seconds : 0;
  const language = typeof result === "string" ? "pt" : result.languages?.[0]?.code ?? "pt";

  const lowered = raw.trim().toLowerCase();
  const onlyArtifacts = lowered.length < 80 && SILENCE_ARTIFACTS.some((p) => lowered.includes(p));
  const text = onlyArtifacts ? "" : cleanClinicalTranscript(raw);

  const segments: CleanedSegment[] = text
    ? [{ text, start: startOffsetSec, end: startOffsetSec + durationSec, confidence: 0.95 }]
    : [];

  return { text, durationSec, language, segments };
}
