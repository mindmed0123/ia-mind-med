// Builds a clean, copy-paste-friendly plain-text version of a laudo,
// suitable for pasting into other medical/PEP systems.

type AnyRec = Record<string, any>;

function line(s = "") {
  return s.endsWith("\n") ? s : `${s}\n`;
}

function hr() {
  return "------------------------------------------------------------\n";
}

function section(title: string, content: string | undefined | null) {
  const body = (content || "").toString().trim();
  if (!body) return "";
  return `\n${title.toUpperCase()}\n${hr()}${body}\n`;
}

function listSection(title: string, items: any[] | undefined | null, numbered = true) {
  if (!items || !Array.isArray(items) || items.length === 0) return "";
  const lines = items
    .map((it, i) => {
      const text = typeof it === "string" ? it : (it?.text || it?.description || JSON.stringify(it));
      const t = String(text).trim();
      if (!t) return "";
      return numbered ? `${i + 1}. ${t}` : `• ${t}`;
    })
    .filter(Boolean);
  if (lines.length === 0) return "";
  return `\n${title.toUpperCase()}\n${hr()}${lines.join("\n")}\n`;
}

function patientBlock(p: AnyRec | undefined | null, createdAt?: string) {
  if (!p) return "";
  const sex =
    p.sexo === "M" ? "Masculino" : p.sexo === "F" ? "Feminino" : (p.sexo || "—");
  const lines: string[] = [];
  lines.push(`Paciente: ${p.nome_completo || p.iniciais || "—"}`);
  if (p.idade) lines.push(`Idade: ${p.idade}${typeof p.idade === "number" ? " anos" : ""}`);
  lines.push(`Sexo: ${sex}`);
  if (p.queixa_principal) lines.push(`Queixa principal: ${p.queixa_principal}`);
  if (createdAt) {
    try {
      lines.push(`Data: ${new Date(createdAt).toLocaleDateString("pt-BR")}`);
    } catch {
      /* ignore */
    }
  }
  return `\nDADOS DO PACIENTE\n${hr()}${lines.join("\n")}\n`;
}

export interface LaudoCleanInput {
  patient_data?: AnyRec | null;
  sections?: AnyRec | null;
  hypotheses?: AnyRec | null;
  cid10_codes?: string[] | null;
  conducts?: any[] | null;
  complementary_exams?: any[] | null;
  red_flags?: any[] | null;
  diagnosis_main?: string | null;
  diagnosis_diff?: string | null;
  summary?: AnyRec | null;
  created_at?: string;
  legal_disclaimer?: string | null;
}

export function buildCleanLaudoText(laudo: LaudoCleanInput): string {
  const s: AnyRec = laudo.sections || {};
  const h: AnyRec = laudo.hypotheses || {};
  const out: string[] = [];

  out.push("LAUDO CLÍNICO\n");
  out.push(hr());

  out.push(patientBlock(laudo.patient_data, laudo.created_at));

  // Anamnese (queixa + HDA + ISDA + antecedentes + hábitos + medicações + vitais)
  const anamneseParts: string[] = [];
  if (s.queixa) anamneseParts.push(`Queixa principal: ${s.queixa}`);
  const hda = s.hda || laudo.summary?.resumo_clinico;
  if (hda) anamneseParts.push(`História da doença atual:\n${hda}`);
  if (s.isda) anamneseParts.push(`Interrogatório sistemático:\n${s.isda}`);
  if (s.antecedentes_pessoais) anamneseParts.push(`Antecedentes pessoais:\n${s.antecedentes_pessoais}`);
  if (s.antecedentes_familiares) anamneseParts.push(`Antecedentes familiares:\n${s.antecedentes_familiares}`);
  if (s.habitos_de_vida) anamneseParts.push(`Hábitos de vida:\n${s.habitos_de_vida}`);
  if (s.medicacoes_em_uso) anamneseParts.push(`Medicações em uso:\n${s.medicacoes_em_uso}`);
  if (s.sinais_vitais_texto) anamneseParts.push(`Sinais vitais: ${s.sinais_vitais_texto}`);
  out.push(section("Anamnese", anamneseParts.join("\n\n")));

  // Histórico médico (apenas se diferente dos antecedentes já listados)
  const hist =
    (s.historico && s.historico !== s.antecedentes_pessoais)
      ? s.historico
      : (laudo.patient_data?.historico && laudo.patient_data?.historico !== s.antecedentes_pessoais
        ? laudo.patient_data.historico
        : "");
  out.push(section("Histórico médico", hist));

  // Exame físico
  out.push(section("Exame físico", s.exame_fisico));

  // Hipóteses diagnósticas
  const principal =
    s.hipoteses?.principal || h.mais_provavel?.descricao || laudo.diagnosis_main || "";
  const diferencial =
    s.hipoteses?.diferencial || h.menos_provavel?.descricao || laudo.diagnosis_diff || "";
  if (principal || diferencial) {
    const parts: string[] = [];
    if (principal) parts.push(`1. Hipótese mais provável: ${principal}`);
    if (h.mais_provavel?.racional) parts.push(`   Racional: ${h.mais_provavel.racional}`);
    if (diferencial) parts.push(`2. Diagnóstico diferencial: ${diferencial}`);
    if (h.menos_provavel?.racional) parts.push(`   Racional: ${h.menos_provavel.racional}`);
    out.push(section("Hipóteses diagnósticas", parts.join("\n")));
  }

  // CID-10
  if (laudo.cid10_codes && laudo.cid10_codes.length > 0) {
    out.push(section("CID-10", laudo.cid10_codes.join(", ")));
  }

  // Conduta
  if (s.conduta) {
    out.push(section("Conduta", s.conduta));
  } else if (laudo.conducts && laudo.conducts.length > 0) {
    out.push(listSection("Conduta", laudo.conducts, true));
  }

  // Exames complementares
  const examesText =
    s.exames_complementares ||
    (laudo.complementary_exams && laudo.complementary_exams.length > 0
      ? laudo.complementary_exams
          .map((e, i) => (typeof e === "string" ? `${i + 1}. ${e}` : `${i + 1}. ${JSON.stringify(e)}`))
          .join("\n")
      : "");
  if (examesText) {
    out.push(section("Exames complementares", examesText));
  }

  // Sinais de alerta / Red flags
  if (laudo.red_flags && laudo.red_flags.length > 0) {
    out.push(listSection("Sinais de alerta / Red flags", laudo.red_flags, false));
  }

  // Orientações ao paciente
  out.push(section("Orientações ao paciente", s.orientacoes || s.orientacoes_paciente));

  // Observações médicas adicionais
  out.push(
    section(
      "Observações médicas adicionais",
      s.observacoes || s.observacoes_medicas || s.descricao_manual_exames,
    ),
  );

  // Specialty extras
  if (s.specialty_sections && typeof s.specialty_sections === "object") {
    const tmpl: any[] = Array.isArray(s.template_sections) ? s.template_sections : [];
    const ordered = tmpl.length
      ? [...tmpl].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : Object.keys(s.specialty_sections).map((k) => ({ key: k, label: k }));
    for (const sec of ordered) {
      const value = s.specialty_sections[sec.key];
      if (value && typeof value === "string" && value.trim()) {
        out.push(section(sec.label || sec.key, value));
      }
    }
  }

  if (laudo.legal_disclaimer) {
    out.push(`\n${hr()}${laudo.legal_disclaimer}\n`);
  }

  return out.join("").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
