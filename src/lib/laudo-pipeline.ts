export interface LaudoPipelineSnapshot {
  status?: string | null;
  transcript_status?: string | null;
  audio_processing_status?: string | null;
  transcript?: unknown;
}

export const GENERATION_RECOVERY_WINDOW_MS = 5000;

function extractTranscriptText(transcript: unknown) {
  if (typeof transcript === "string") {
    return transcript;
  }

  if (transcript && typeof transcript === "object" && "text" in transcript) {
    const value = (transcript as { text?: unknown }).text;
    return typeof value === "string" ? value : "";
  }

  return "";
}

export function isReadyToGenerate(snapshot?: LaudoPipelineSnapshot | null) {
  const transcriptText = extractTranscriptText(snapshot?.transcript);

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
      snapshot?.audio_processing_status === "error" ||
      snapshot?.audio_processing_status === "failed",
  );
}

export function getPollingDelayMs(pollCount: number) {
  if (pollCount < 5) return 1000;   // First 5s: aggressive
  if (pollCount < 20) return 1500;  // Next 22s: normal
  return 2500;                       // After: relaxed
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
const slugEspecialidade = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/**
 * Converte a especialidade do perfil (texto livre) na chave de um tipo de
 * consulta cadastrado. Sem correspondência, usa Clínica Geral.
 */
export function resolveTemplateSpecialty(
  profileSpecialty: string | null | undefined,
  templates: { specialty: string; display_name: string }[],
): string {
  const fallback = templates.some((t) => t.specialty === "clinica_geral") ? "clinica_geral" : templates[0]?.specialty ?? "clinica_geral";
  if (!profileSpecialty) return fallback;
  const alvo = slugEspecialidade(profileSpecialty);
  const match = templates.find(
    (t) => t.specialty === profileSpecialty || slugEspecialidade(t.specialty) === alvo || slugEspecialidade(t.display_name) === alvo,
  );
  return match?.specialty ?? fallback;
}
