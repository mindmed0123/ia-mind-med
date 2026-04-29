// Shared utilities to maximize Whisper accuracy on Brazilian Portuguese
// medical consultations. Used by both transcribe-audio (single-shot) and
// transcribe-chunk (parallel chunked pipeline).

/**
 * Clinical priming prompt for Whisper (PT-BR).
 *
 * Whisper uses the `prompt` field as biasing context — it does NOT execute
 * instructions, but it WILL prefer the spelling/casing/terms it sees here.
 * Keep it under ~224 tokens (Whisper's prompt window).
 *
 * Strategy: pack the most-used medical Portuguese terms (specialties,
 * medications, anatomy, exams, vitals, abbreviations, CID-10) so the model
 * resolves ambiguous audio toward the correct clinical spelling.
 */
export const CLINICAL_WHISPER_PROMPT_PT_BR = [
  "Consulta médica em português do Brasil.",
  "Especialidades: cardiologia, neurologia, pneumologia, endocrinologia, gastroenterologia, nefrologia, ortopedia, ginecologia, obstetrícia, pediatria, psiquiatria, dermatologia, urologia, oftalmologia, otorrinolaringologia, reumatologia, oncologia, hematologia, infectologia.",
  "Sintomas: dispneia, dor torácica, palpitação, síncope, cefaleia, tontura, parestesia, disúria, hematúria, melena, hematêmese, êmese, diarreia, constipação, astenia, adinamia, anorexia, edema, prurido, dispepsia, pirose.",
  "Sinais vitais: PA 120x80 mmHg, FC 80 bpm, FR 16 irpm, SatO2 98%, Tax 36,5°C, glicemia 90 mg/dL, HGT.",
  "Medicações: losartana, enalapril, hidroclorotiazida, anlodipino, metformina, glibenclamida, omeprazol, dipirona, paracetamol, ibuprofeno, amoxicilina, azitromicina, ciprofloxacino, sinvastatina, atorvastatina, AAS, clopidogrel, varfarina, rivaroxabana, levotiroxina, sertralina, fluoxetina, clonazepam, prednisona.",
  "Diagnósticos: HAS, DM2, DPOC, ICC, IAM, AVC, AVE, IRC, DRC, ITU, IVAS, TVP, TEP, RGE, fibrilação atrial, hipotireoidismo, dislipidemia, asma, pneumonia.",
  "Exames: ECG, ECO, RX de tórax, TC, RM, USG, hemograma, ureia, creatinina, TGO, TGP, TSH, T4 livre, PCR, VHS, EAS, HbA1c, INR.",
  "CID-10: I10, I50, E11, J44, J45, K21, N18, F32, F41, M54.",
  "Conduta: prescrever, solicitar, encaminhar, retorno em 30 dias, observação, internação.",
].join(" ");

/**
 * Post-process Whisper output to fix common clinical transcription artifacts:
 * - normalize blood pressure ("120 por 80" → "120x80 mmHg")
 * - re-uppercase clinical acronyms (pa → PA, fc → FC, etc.)
 * - tighten unit spacing ("80 bpm", "36,5 °C" consistent)
 * - collapse runs of whitespace
 */
export function cleanClinicalTranscript(raw: string): string {
  if (!raw) return raw;
  let text = raw;

  // Blood pressure: "120 por 80", "120 sobre 80", "120 / 80" → "120x80 mmHg"
  text = text.replace(
    /\b(\d{2,3})\s*(?:por|sobre|\/|x|×)\s*(\d{2,3})(\s*(?:mmHg|mm\s*Hg))?/gi,
    (_m, a, b, _u) => `${a}x${b} mmHg`,
  );

  // Numeric units — ensure single space and lowercase unit consistently
  text = text.replace(/(\d)\s*(mg|mcg|µg|g|ml|mL|l|L|UI|ui)\b/gi, (_m, n, u) => {
    const unit = u.toLowerCase() === "ui" ? "UI" : u.toLowerCase().replace("l", "L");
    // mg/mcg/g stay lowercase; mL/L uppercase L; UI uppercase
    const norm =
      unit === "L" ? "L" :
      unit === "mL" ? "mL" :
      unit === "UI" ? "UI" :
      unit;
    return `${n} ${norm}`;
  });

  // bpm / irpm / kg / cm / °C — keep tight spacing
  text = text.replace(/(\d)\s*(bpm|irpm|kg|cm|mm|°\s*C|graus?\s*celsius)/gi,
    (_m, n, u) => {
      const u2 = /graus?/i.test(u) ? "°C" : u.replace(/\s+/g, "");
      return `${n} ${u2.toLowerCase() === "bpm" || u2.toLowerCase() === "irpm" ? u2.toLowerCase() : u2}`;
    });

  // SatO2 normalization: "sat o2", "saturação de o2", "satO2 de" → "SatO2 "
  text = text.replace(/\bsat(?:ura(?:ç|c)(?:ã|a)o)?\s*(?:de\s+)?o\s*2\b\s*(?:de\s+)?/gi, "SatO2 ");

  // Re-uppercase common clinical acronyms when surrounded by spaces/punct
  const acronyms = [
    "PA","FC","FR","SatO2","ECG","ECO","RX","TC","RM","USG","TSH","HGT",
    "HAS","DM","DM1","DM2","DPOC","ICC","IAM","AVC","AVE","IRC","DRC","ITU","IVAS",
    "TVP","TEP","RGE","FA","HbA1c","INR","PCR","VHS","EAS","TGO","TGP","AAS",
    "BCF","MV","RCR","AC","AP","ACV","SNC","AVD","MMSS","MMII","CID","CID-10",
    "HMA","HPP","HF","HD","SUS","UTI","PS","UPA","ESF","UBS",
  ];
  for (const ac of acronyms) {
    const re = new RegExp(`(^|[\\s\\.,;:\\(\\)\\-/])(${ac.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})(?=$|[\\s\\.,;:\\(\\)\\-/])`, "gi");
    text = text.replace(re, (_m, pre) => `${pre}${ac}`);
  }

  // Collapse multi-space and fix space-before-punct
  text = text.replace(/[ \t]+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();

  return text;
}

/**
 * Decide whether a Whisper segment is likely a hallucination (silence padding,
 * music intro phrases, "obrigado por assistir" artifacts that Whisper emits on
 * empty audio) and should be dropped.
 */
export function isLikelyHallucination(seg: {
  text?: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
}): boolean {
  const txt = (seg.text || "").trim().toLowerCase();
  if (!txt) return true;

  // Whisper hallucinates these on silence/noise
  const hallucinationPhrases = [
    "obrigado por assistir",
    "obrigado por assistirem",
    "inscreva-se no canal",
    "legendas pela comunidade",
    "legendado por",
    "tradução",
    "amara.org",
    "subscribe",
    "thanks for watching",
  ];
  if (hallucinationPhrases.some((p) => txt.includes(p))) return true;

  // High no-speech probability + short text → silence
  if ((seg.no_speech_prob ?? 0) > 0.6 && txt.length < 40) return true;

  // Extremely low logprob → garbage
  if ((seg.avg_logprob ?? 0) < -1.0) return true;

  // Compression ratio > 2.4 → repetitive loops ("não não não não...")
  if ((seg.compression_ratio ?? 0) > 2.4) return true;

  return false;
}

export interface CleanedSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

/**
 * Convert raw Whisper segments → cleaned segments with offset, dropping
 * hallucinations and applying clinical text normalization.
 */
export function processWhisperSegments(
  rawSegments: any[],
  startOffsetSec = 0,
): CleanedSegment[] {
  if (!Array.isArray(rawSegments)) return [];
  return rawSegments
    .filter((seg) => !isLikelyHallucination(seg))
    .map((seg) => ({
      text: cleanClinicalTranscript(seg.text || ""),
      start: (seg.start || 0) + startOffsetSec,
      end: (seg.end || 0) + startOffsetSec,
      confidence: seg.no_speech_prob != null ? 1 - seg.no_speech_prob : 0.9,
    }))
    .filter((s) => s.text.length > 0);
}

/**
 * Build the final clean transcript text from cleaned segments.
 * Preferred over Whisper's raw `text` field because that includes the
 * hallucinations we just filtered.
 */
export function transcriptFromSegments(segments: CleanedSegment[]): string {
  return cleanClinicalTranscript(segments.map((s) => s.text).join(" "));
}
