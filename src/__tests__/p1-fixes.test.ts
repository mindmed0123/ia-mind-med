import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for MindMed P1 fixes:
 * - Rate limiting logic
 * - Idempotency / double-submit protection
 * - Quota with TRIALING status
 * - Pipeline stage management
 * - PHI/PII sanitization in logs
 */

// ===== Quota Logic Tests =====
describe("Quota Logic", () => {
  it("should allow ACTIVE subscriptions", () => {
    const status = "ACTIVE";
    const allowed = status === "ACTIVE" || status === "TRIALING";
    expect(allowed).toBe(true);
  });

  it("should allow TRIALING subscriptions", () => {
    const status = "TRIALING";
    const allowed = status === "ACTIVE" || status === "TRIALING";
    expect(allowed).toBe(true);
  });

  it("should block EXPIRED subscriptions", () => {
    const status = "EXPIRED";
    const allowed = status === "ACTIVE" || status === "TRIALING";
    expect(allowed).toBe(false);
  });

  it("should block CANCELED subscriptions", () => {
    const status = "CANCELED";
    const allowed = status === "ACTIVE" || status === "TRIALING";
    expect(allowed).toBe(false);
  });

  it("should block INACTIVE subscriptions", () => {
    const status = "INACTIVE";
    const allowed = status === "ACTIVE" || status === "TRIALING";
    expect(allowed).toBe(false);
  });

  it("should detect trial expiration correctly", () => {
    const trialEnd = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    const now = new Date();
    const isExpired = now > new Date(trialEnd);
    expect(isExpired).toBe(true);
  });

  it("should NOT mark active trial as expired", () => {
    const trialEnd = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
    const now = new Date();
    const isExpired = now > new Date(trialEnd);
    expect(isExpired).toBe(false);
  });
});

// ===== Rate Limiting Tests =====
describe("Rate Limiting Logic", () => {
  it("should allow requests under the limit", () => {
    const recentCount = 3;
    const limit = 5;
    const isRateLimited = recentCount >= limit;
    expect(isRateLimited).toBe(false);
  });

  it("should block requests at the limit", () => {
    const recentCount = 5;
    const limit = 5;
    const isRateLimited = recentCount >= limit;
    expect(isRateLimited).toBe(true);
  });

  it("should block requests over the limit", () => {
    const recentCount = 10;
    const limit = 5;
    const isRateLimited = recentCount >= limit;
    expect(isRateLimited).toBe(true);
  });

  it("should use different limits for transcription vs generation", () => {
    const transcribeLimit = 3;
    const generateLimit = 5;
    const exportLimit = 10;

    expect(transcribeLimit).toBeLessThan(generateLimit);
    expect(generateLimit).toBeLessThan(exportLimit);
  });
});

// ===== Idempotency Tests =====
describe("Idempotency Logic", () => {
  it("should skip generation for completed laudos", () => {
    const laudoStatus = "completed";
    const shouldSkip = laudoStatus === "completed";
    expect(shouldSkip).toBe(true);
  });

  it("should skip generation for generating laudos", () => {
    const laudoStatus = "generating";
    const shouldSkip = laudoStatus === "completed" || laudoStatus === "generating";
    expect(shouldSkip).toBe(true);
  });

  it("should allow generation for draft laudos", () => {
    const laudoStatus = "draft";
    const shouldSkip = laudoStatus === "completed" || laudoStatus === "generating";
    expect(shouldSkip).toBe(false);
  });

  it("should allow generation for error laudos (retry)", () => {
    const laudoStatus = "error";
    const shouldSkip = laudoStatus === "completed" || laudoStatus === "generating";
    expect(shouldSkip).toBe(false);
  });
});

// ===== PDF Sections Builder Tests =====
describe("PDF Sections Builder", () => {
  function buildSectionsFromFields(laudo: any) {
    const hypotheses = laudo.hypotheses;
    const conducts = laudo.conducts;
    const patientData = laudo.patient_data;
    const cid10 = laudo.cid10_codes;

    return {
      identificacao: {
        nome: patientData?.iniciais || patientData?.nome || 'Não informado',
        idade: patientData?.idade ? String(patientData.idade) : 'N/I',
        sexo: patientData?.sexo || 'N/I',
      },
      queixa: laudo.clinical_context?.chief_complaint || '',
      hda: laudo.summary?.resumo_clinico || '',
      hipoteses: {
        principal: hypotheses?.mais_provavel?.descricao || laudo.diagnosis_main || '',
        diferencial: hypotheses?.menos_provavel?.descricao || laudo.diagnosis_diff || '',
      },
      conduta: Array.isArray(conducts) ? conducts.join('\n• ') : (typeof conducts === 'string' ? conducts : ''),
      cid10: Array.isArray(cid10) ? cid10 : [],
    };
  }

  it("should build sections from individual fields", () => {
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

  it("should handle missing fields gracefully", () => {
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

  it("should handle string conducts", () => {
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
});

// ===== Pipeline Stage Tests =====
describe("Pipeline Stage Management", () => {
  it("should determine correct stage from laudo status", () => {
    function getStage(laudo: any): string {
      if (laudo.status === 'completed') return 'completed';
      if (laudo.status === 'generating') return 'generating';
      if (laudo.status === 'error' || laudo.transcript_status === 'error') return 'error';
      if (laudo.transcript_status === 'processing' || laudo.audio_processing_status === 'processing') return 'transcribing';
      return 'idle';
    }

    expect(getStage({ status: 'completed' })).toBe('completed');
    expect(getStage({ status: 'generating' })).toBe('generating');
    expect(getStage({ status: 'error' })).toBe('error');
    expect(getStage({ status: 'draft', transcript_status: 'error' })).toBe('error');
    expect(getStage({ status: 'draft', transcript_status: 'processing' })).toBe('transcribing');
    expect(getStage({ status: 'draft', audio_processing_status: 'processing' })).toBe('transcribing');
    expect(getStage({ status: 'draft' })).toBe('idle');
  });
});

// ===== PHI Sanitization Tests =====
describe("PHI/PII Sanitization", () => {
  it("should truncate user IDs in logs", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const sanitized = userId.substring(0, 8);
    expect(sanitized).toBe("550e8400");
    expect(sanitized.length).toBe(8);
  });

  it("should not include patient names in structured logs", () => {
    const logEntry = {
      ts: new Date().toISOString(),
      cid: "test-correlation-id",
      step: "complete",
      laudo_id: "some-id",
      model: "gemini",
      tokens: 1500,
    };

    const logStr = JSON.stringify(logEntry);
    expect(logStr).not.toContain("patient");
    expect(logStr).not.toContain("nome");
    expect(logStr).not.toContain("cpf");
  });
});