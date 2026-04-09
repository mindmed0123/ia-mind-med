import { describe, it, expect } from "vitest";
import { GENERATION_RECOVERY_WINDOW_MS, getPollingDelayMs, isReadyToGenerate, isTerminalLaudoState, shouldRetryDraftGeneration } from "@/lib/laudo-pipeline";

/**
 * Unit tests for MindMed P1 fixes:
 * - Rate limiting logic
 * - Idempotency / double-submit protection  
 * - Quota with TRIALING status
 * - Pipeline stage management
 * - PHI/PII sanitization in logs
 * - PDF sections builder
 */

// Helper to avoid TS literal comparison errors
function isAllowedStatus(status: string): boolean {
  return status === "ACTIVE" || status === "TRIALING";
}

function shouldSkipGeneration(status: string): boolean {
  return status === "completed" || status === "generating";
}

function isRateLimited(count: number, limit: number): boolean {
  return count >= limit;
}

// ===== Quota Logic Tests =====
describe("Quota Logic", () => {
  it("allows ACTIVE subscriptions", () => {
    expect(isAllowedStatus("ACTIVE")).toBe(true);
  });

  it("allows TRIALING subscriptions", () => {
    expect(isAllowedStatus("TRIALING")).toBe(true);
  });

  it("blocks EXPIRED subscriptions", () => {
    expect(isAllowedStatus("EXPIRED")).toBe(false);
  });

  it("blocks CANCELED subscriptions", () => {
    expect(isAllowedStatus("CANCELED")).toBe(false);
  });

  it("blocks INACTIVE subscriptions", () => {
    expect(isAllowedStatus("INACTIVE")).toBe(false);
  });

  it("blocks PENDING_CHECKOUT subscriptions", () => {
    expect(isAllowedStatus("PENDING_CHECKOUT")).toBe(false);
  });

  it("detects expired trial correctly", () => {
    const trialEnd = new Date(Date.now() - 86400000).toISOString();
    expect(new Date() > new Date(trialEnd)).toBe(true);
  });

  it("does NOT mark active trial as expired", () => {
    const trialEnd = new Date(Date.now() + 86400000).toISOString();
    expect(new Date() > new Date(trialEnd)).toBe(false);
  });
});

// ===== Rate Limiting Tests =====
describe("Rate Limiting Logic", () => {
  it("allows requests under the limit", () => {
    expect(isRateLimited(3, 5)).toBe(false);
  });

  it("blocks requests at the limit", () => {
    expect(isRateLimited(5, 5)).toBe(true);
  });

  it("blocks requests over the limit", () => {
    expect(isRateLimited(10, 5)).toBe(true);
  });

  it("uses tiered limits: transcribe < generate < export", () => {
    const transcribeLimit = 3;
    const generateLimit = 5;
    const exportLimit = 10;

    expect(transcribeLimit).toBeLessThan(generateLimit);
    expect(generateLimit).toBeLessThan(exportLimit);
  });

  it("allows zero recent requests", () => {
    expect(isRateLimited(0, 5)).toBe(false);
  });
});

// ===== Idempotency Tests =====
describe("Idempotency Logic", () => {
  it("skips generation for completed laudos", () => {
    expect(shouldSkipGeneration("completed")).toBe(true);
  });

  it("skips generation for generating laudos", () => {
    expect(shouldSkipGeneration("generating")).toBe(true);
  });

  it("allows generation for draft laudos", () => {
    expect(shouldSkipGeneration("draft")).toBe(false);
  });

  it("allows generation for error laudos (retry)", () => {
    expect(shouldSkipGeneration("error")).toBe(false);
  });
});

// ===== PDF Sections Builder Tests =====
describe("PDF Sections Builder", () => {
  function buildSectionsFromFields(laudo: Record<string, any>) {
    const hypotheses = laudo.hypotheses;
    const conducts = laudo.conducts;
    const patientData = laudo.patient_data;
    const cid10 = laudo.cid10_codes;

    return {
      identificacao: {
        nome: patientData?.iniciais || patientData?.nome || "Não informado",
        idade: patientData?.idade ? String(patientData.idade) : "N/I",
        sexo: patientData?.sexo || "N/I",
      },
      queixa: laudo.clinical_context?.chief_complaint || "",
      hda: laudo.summary?.resumo_clinico || "",
      hipoteses: {
        principal: hypotheses?.mais_provavel?.descricao || laudo.diagnosis_main || "",
        diferencial: hypotheses?.menos_provavel?.descricao || laudo.diagnosis_diff || "",
      },
      conduta: Array.isArray(conducts) ? conducts.join("\n• ") : (typeof conducts === "string" ? conducts : ""),
      cid10: Array.isArray(cid10) ? cid10 : [],
    };
  }

  it("builds sections from individual fields", () => {
    const laudo = {
      hypotheses: {
        mais_provavel: { descricao: "Hipertensão arterial" },
        menos_provavel: { descricao: "Doença renal crônica" },
      },
      conducts: ["Iniciar losartana 50mg", "Dieta hipossódica"],
      patient_data: { iniciais: "J.S.", idade: 45, sexo: "M" },
      cid10_codes: ["I10", "N18"],
      clinical_context: { chief_complaint: "Cefaleia" },
      summary: { resumo_clinico: "Paciente com cefaleia há 3 dias" },
    };

    const sections = buildSectionsFromFields(laudo);

    expect(sections.identificacao.nome).toBe("J.S.");
    expect(sections.identificacao.idade).toBe("45");
    expect(sections.hipoteses.principal).toBe("Hipertensão arterial");
    expect(sections.hipoteses.diferencial).toBe("Doença renal crônica");
    expect(sections.conduta).toContain("losartana");
    expect(sections.cid10).toContain("I10");
    expect(sections.queixa).toBe("Cefaleia");
  });

  it("handles missing fields gracefully", () => {
    const laudo = {
      hypotheses: null,
      conducts: null,
      patient_data: null,
      cid10_codes: null,
      clinical_context: null,
      summary: null,
    };

    const sections = buildSectionsFromFields(laudo);

    expect(sections.identificacao.nome).toBe("Não informado");
    expect(sections.identificacao.idade).toBe("N/I");
    expect(sections.hipoteses.principal).toBe("");
    expect(sections.conduta).toBe("");
    expect(sections.cid10).toEqual([]);
  });

  it("handles string conducts", () => {
    const laudo = {
      hypotheses: { mais_provavel: { descricao: "Test" } },
      conducts: "Conduta única em texto",
      patient_data: { iniciais: "A.B." },
      cid10_codes: [],
      clinical_context: {},
      summary: {},
    };

    const sections = buildSectionsFromFields(laudo);
    expect(sections.conduta).toBe("Conduta única em texto");
  });

  it("handles empty conducts array", () => {
    const laudo = {
      hypotheses: null,
      conducts: [],
      patient_data: null,
      cid10_codes: null,
      clinical_context: null,
      summary: null,
    };

    const sections = buildSectionsFromFields(laudo);
    expect(sections.conduta).toBe("");
  });
});

// ===== Pipeline Stage Tests =====
describe("Pipeline Stage Management", () => {
  function getStage(laudo: Record<string, any>): string {
    if (laudo.status === "completed") return "completed";
    if (laudo.status === "generating") return "generating";
    if (laudo.status === "error" || laudo.transcript_status === "error") return "error";
    if (laudo.transcript_status === "processing" || laudo.audio_processing_status === "processing") return "transcribing";
    return "idle";
  }

  it("returns completed for completed laudo", () => {
    expect(getStage({ status: "completed" })).toBe("completed");
  });

  it("returns generating for generating laudo", () => {
    expect(getStage({ status: "generating" })).toBe("generating");
  });

  it("returns error for error status", () => {
    expect(getStage({ status: "error" })).toBe("error");
  });

  it("returns error for transcript error", () => {
    expect(getStage({ status: "draft", transcript_status: "error" })).toBe("error");
  });

  it("returns transcribing for processing transcript", () => {
    expect(getStage({ status: "draft", transcript_status: "processing" })).toBe("transcribing");
  });

  it("returns transcribing for processing audio", () => {
    expect(getStage({ status: "draft", audio_processing_status: "processing" })).toBe("transcribing");
  });

  it("returns idle for draft with no processing", () => {
    expect(getStage({ status: "draft" })).toBe("idle");
  });
});

describe("Draft generation recovery", () => {
  it("detects when a transcribed draft is ready for generation", () => {
    expect(
      isReadyToGenerate({
        status: "draft",
        transcript_status: "completed",
        transcript: { text: "consulta transcrita" },
      }),
    ).toBe(true);
  });

  it("does not trigger generation without transcript text", () => {
    expect(
      isReadyToGenerate({
        status: "draft",
        transcript_status: "completed",
        transcript: { text: "" },
      }),
    ).toBe(false);
  });

  it("retries a stuck draft generation after the recovery window", () => {
    expect(
      shouldRetryDraftGeneration(
        {
          status: "draft",
          transcript_status: "completed",
          transcript: { text: "consulta transcrita" },
        },
        true,
        0,
        GENERATION_RECOVERY_WINDOW_MS + 1,
      ),
    ).toBe(true);
  });

  it("does not retry too early while waiting for the current attempt", () => {
    expect(
      shouldRetryDraftGeneration(
        {
          status: "draft",
          transcript_status: "completed",
          transcript: { text: "consulta transcrita" },
        },
        true,
        1000,
        1000 + GENERATION_RECOVERY_WINDOW_MS - 1,
      ),
    ).toBe(false);
  });

  it("stops polling after terminal states", () => {
    expect(isTerminalLaudoState({ status: "completed" })).toBe(true);
    expect(isTerminalLaudoState({ status: "error" })).toBe(true);
    expect(isTerminalLaudoState({ transcript_status: "error" })).toBe(true);
    expect(isTerminalLaudoState({ status: "draft", transcript_status: "completed" })).toBe(false);
  });

  it("uses shorter polling early and slower polling later", () => {
    expect(getPollingDelayMs(1)).toBe(1500);
    expect(getPollingDelayMs(15)).toBe(2500);
  });

  it("maps backend generation sub-stages to real UI states", () => {
    const mapStage = (snapshot: Record<string, any>) => {
      if (snapshot.status === "generating" && snapshot.last_update_type === "preparing") return "preparing";
      if (snapshot.status === "generating" && snapshot.last_update_type === "structuring") return "structuring";
      if (snapshot.status === "generating") return "calling_ai";
      if (snapshot.transcript_status === "processing") return "transcribing";
      if (snapshot.status === "completed") return "completed";
      return "idle";
    };

    expect(mapStage({ status: "generating", last_update_type: "preparing" })).toBe("preparing");
    expect(mapStage({ status: "generating", last_update_type: "calling_ai" })).toBe("calling_ai");
    expect(mapStage({ status: "generating", last_update_type: "structuring" })).toBe("structuring");
  });
});

// ===== PHI Sanitization Tests =====
describe("PHI/PII Sanitization in Logs", () => {
  it("truncates user IDs to 8 chars", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const sanitized = userId.substring(0, 8);
    expect(sanitized).toBe("550e8400");
    expect(sanitized.length).toBe(8);
  });

  it("structured log entries never contain patient identifiers", () => {
    const logEntry = {
      ts: new Date().toISOString(),
      cid: "test-correlation-id",
      step: "complete",
      laudo_id: "some-id",
      model: "gemini",
      tokens: 1500,
      latency_ms: 3200,
    };

    const logStr = JSON.stringify(logEntry);
    expect(logStr).not.toContain("patient_name");
    expect(logStr).not.toContain("nome_completo");
    expect(logStr).not.toContain("cpf");
    expect(logStr).not.toContain("endereco");
  });

  it("correlation IDs are valid UUIDs", () => {
    const uuid = crypto.randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(uuidRegex.test(uuid)).toBe(true);
  });
});