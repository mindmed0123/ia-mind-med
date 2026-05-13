import html2pdf from "html2pdf.js";
import { TriagemHantavirus, RISCO_CONFIG, SINTOMAS_LABELS, FATORES_LABELS } from "@/types/hantavirus";
import { maskCpf } from "@/lib/cpf";

export interface PdfDoctor {
  full_name?: string | null;
  crm?: string | null;
  crm_uf?: string | null;
  specialty?: string | null;
  clinic_name?: string | null;
}

export async function gerarLaudoHantavirusPdf(
  triagem: TriagemHantavirus & { patient_cpf?: string | null },
  doctor: PdfDoctor
): Promise<void> {
  const risco = RISCO_CONFIG[triagem.classificacao_risco ?? "baixo"];
  const sintomas = Object.entries(triagem.sintomas)
    .filter(([, v]) => v === true)
    .map(([k]) => SINTOMAS_LABELS[k as keyof typeof SINTOMAS_LABELS] || k);
  const fatores = Object.entries(triagem.fatores_epidemiologicos)
    .filter(([, v]) => v === true)
    .map(([k]) => FATORES_LABELS[k as keyof typeof FATORES_LABELS] || k);

  const dataFmt = new Date(triagem.created_at).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const cpfFmt = triagem.patient_cpf ? maskCpf(triagem.patient_cpf) : "—";
  const doctorName = doctor.full_name || "Médico responsável";
  const crmStr = doctor.crm ? `CRM ${doctor.crm}${doctor.crm_uf ? `/${doctor.crm_uf}` : ""}` : "";

  const corBorda =
    triagem.classificacao_risco === "critico" ? "#dc2626" :
    triagem.classificacao_risco === "alto" ? "#ef4444" :
    triagem.classificacao_risco === "moderado" ? "#f59e0b" : "#10b981";

  const html = `
  <div style="font-family:'Inter',Arial,sans-serif;color:#0f172a;padding:40px;max-width:780px;line-height:1.5;">
    <div style="border-bottom:3px solid #1e3a8a;padding-bottom:18px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="color:#1e3a8a;font-weight:800;font-size:22px;letter-spacing:-0.5px;">MindMed</div>
          <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Auxílio Diagnóstico Clínico por IA</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b;">
          <div><strong>Emissão:</strong> ${dataFmt}</div>
          <div><strong>ID:</strong> ${triagem.id.substring(0, 8).toUpperCase()}</div>
        </div>
      </div>
    </div>

    <h1 style="font-size:18px;margin:0 0 6px 0;color:#0f172a;">LAUDO DE TRIAGEM — SUSPEITA DE HANTAVÍRUS</h1>
    <p style="margin:0 0 22px 0;font-size:11px;color:#64748b;">Documento de auxílio diagnóstico — Surto Vírus Andes 2026</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:18px;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:8px;">Dados do Paciente</div>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="padding:3px 0;width:120px;color:#64748b;">Nome completo:</td><td style="font-weight:600;">${triagem.patient_name}</td></tr>
        <tr><td style="padding:3px 0;color:#64748b;">CPF:</td><td style="font-weight:600;">${cpfFmt}</td></tr>
      </table>
    </div>

    <div style="border:2px solid ${corBorda};border-radius:10px;padding:16px;margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Classificação de Risco</div>
          <div style="font-size:22px;font-weight:800;color:${corBorda};margin-top:2px;">${risco.emoji} ${risco.label}</div>
          <div style="font-size:12px;color:#475569;margin-top:4px;">${risco.descricao}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;">Probabilidade</div>
          <div style="font-size:42px;font-weight:800;color:${corBorda};line-height:1;">${triagem.probabilidade_hantavirus ?? 0}<span style="font-size:18px;">%</span></div>
        </div>
      </div>
    </div>

    <div style="margin-bottom:18px;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Sintomas Identificados (${sintomas.length})</div>
      <div style="font-size:12px;">${sintomas.length ? sintomas.map(s => `<div>• ${s}</div>`).join("") : '<em style="color:#94a3b8;">Nenhum sintoma marcado</em>'}</div>
    </div>

    <div style="margin-bottom:18px;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Fatores Epidemiológicos</div>
      <div style="font-size:12px;">${fatores.length ? fatores.map(f => `<div>• ${f}</div>`).join("") : '<em style="color:#94a3b8;">Nenhum fator de risco relatado</em>'}</div>
    </div>

    ${triagem.descricao_sintomas ? `
    <div style="margin-bottom:18px;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Descrição Clínica</div>
      <div style="font-size:12px;background:#f8fafc;padding:10px;border-radius:6px;border-left:3px solid #cbd5e1;white-space:pre-wrap;">${triagem.descricao_sintomas}</div>
    </div>` : ""}

    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Análise Clínica por IA</div>
      <div style="font-size:12px;line-height:1.6;text-align:justify;white-space:pre-wrap;">${triagem.analise_ia || "—"}</div>
    </div>

    ${triagem.imagens_manchas?.length ? `
    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Análise das Imagens (${triagem.imagens_manchas.length})</div>
      <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;">${triagem.analise_imagem_ia || "—"}</div>
    </div>` : ""}

    ${triagem.recomendacoes_ia?.length ? `
    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Recomendações Clínicas</div>
      <ol style="font-size:12px;margin:0;padding-left:18px;line-height:1.7;">
        ${triagem.recomendacoes_ia.map(r => `<li>${r}</li>`).join("")}
      </ol>
    </div>` : ""}

    ${triagem.diferenciais_ia?.length ? `
    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">Diagnósticos Diferenciais</div>
      <div style="font-size:12px;">${triagem.diferenciais_ia.map(d => `• ${d}`).join("<br/>")}</div>
    </div>` : ""}

    ${(triagem.classificacao_risco === "alto" || triagem.classificacao_risco === "critico") ? `
    <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:14px;margin:18px 0;page-break-inside:avoid;">
      <div style="color:#991b1b;font-weight:800;font-size:13px;margin-bottom:6px;">🚨 NOTIFICAÇÃO COMPULSÓRIA</div>
      <div style="font-size:11px;color:#7f1d1d;">Casos suspeitos de Hantavirose são de notificação compulsória (Portaria GM/MS nº 4/2017). Notifique a Vigilância Epidemiológica do município e considere isolamento respiratório imediato.</div>
    </div>` : ""}

    <div style="margin-top:48px;page-break-inside:avoid;">
      <div style="border-top:1px solid #cbd5e1;padding-top:8px;width:300px;text-align:center;">
        <div style="font-weight:700;font-size:13px;">${doctorName}</div>
        ${crmStr ? `<div style="font-size:11px;color:#64748b;">${crmStr}</div>` : ""}
        ${doctor.specialty ? `<div style="font-size:11px;color:#64748b;">${doctor.specialty}</div>` : ""}
        ${doctor.clinic_name ? `<div style="font-size:11px;color:#64748b;">${doctor.clinic_name}</div>` : ""}
      </div>
    </div>

    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center;line-height:1.5;">
      ⚕️ Este laudo foi gerado com auxílio de Inteligência Artificial (GPT-4o) e NÃO substitui avaliação clínica presencial.<br/>
      O médico responsável assume toda decisão diagnóstica e terapêutica. MindMed · Conformidade LGPD.
    </div>
  </div>`;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `Laudo-Hantavirus-${triagem.patient_name.replace(/\s+/g, "_")}-${triagem.id.substring(0, 8)}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      } as any)
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
