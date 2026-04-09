export interface LaudoPipelineSnapshot {
  status?: string | null;
  transcript_status?: string | null;
  audio_processing_status?: string | null;
  transcript?: {
    text?: string;
  } | string | null;
}

export const GENERATION_RECOVERY_WINDOW_MS = 5000;

export function isReadyToGenerate(snapshot?: LaudoPipelineSnapshot | null) {
  const transcriptText = typeof snapshot?.transcript === "string"
    ? snapshot.transcript
    : snapshot?.transcript?.text;

  return Boolean(
    snapshot?.transcript_status === "completed" &&
      snapshot?.status !== "completed" &&
      snapshot?.status !== "generating" &&
      transcriptText,
  );
}

export function isTerminalLaudoState(snapshot?: LaudoPipelineSnapshot | null) {
  return Boolean(
    snapshot?.status === "completed" ||
      snapshot?.status === "error" ||
      snapshot?.transcript_status === "error" ||
      snapshot?.audio_processing_status === "error",
  );
}

export function getPollingDelayMs(pollCount: number) {
  return pollCount < 15 ? 1500 : 2500;
}

export function shouldRetryDraftGeneration(
  snapshot: LaudoPipelineSnapshot | null | undefined,
  hasTriggeredGeneration: boolean,
  lastAttemptAt: number,
  now = Date.now(),
) {
  if (!isReadyToGenerate(snapshot)) {
    return false;
  }

  if (!hasTriggeredGeneration) {
    return true;
  }

  return now - lastAttemptAt >= GENERATION_RECOVERY_WINDOW_MS;
}