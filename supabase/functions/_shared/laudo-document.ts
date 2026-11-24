/**
 * Estrutura do laudo para o PDF (compartilhada entre a função export-pdf e o app).
 * Só organiza o conteúdo já salvo no laudo; não cria nem infere nada clínico.
 */

export type LaudoBlock =
  | { kind: 'fields'; title: string; items: { label: string; text: string }[] }
  | { kind: 'text'; title: string; text: string; small?: boolean }
  | {
      kind: 'hypotheses';
      title: string;
      principal?: { titulo: string; detalhe?: string };
      diferenciais: { titulo: string; detalhe?: string }[];
      cid10: { codigo: string; descricao?: string }[];
    }
  | { kind: 'checklist'; title: string; items: string[] }
  | { kind: 'steps'; title: string; items: string[] }
  | { kind: 'callout'; tone: 'info' | 'warning'; title: string; text: string };

export interface LaudoDocument {
  titulo: string;
  numero: string;
  dataConsulta: string;
  paciente: { nome: string; idade?: string; sexo?: string };
  alergias: string[];
  sinaisVitais: { label: string; value: string }[];
  blocks: LaudoBlock[];
  disclaimer: string;
}

export const DISCLAIMER_LAUDO =
  'Documento estruturado com auxílio de inteligência artificial e revisado pelo médico responsável. Não substitui o julgamento clínico.';

const EMPTY = /^(n[ãa]o informad[oa]|n\/i|n\/a|nenhum[a]?|-|—|null|undefined|ver laudo completo em anexo)\.?$/i;

/** Limpa marcações de markdown e espaços; devolve '' para valores vazios. */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return cleanText(o.descricao ?? o.texto ?? o.nome ?? o.text ?? '');
  }
  const t = String(value)
    .replace(/\r/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return EMPTY.test(t) ? '' : t;
}

function pick(...values: unknown[]): string {
  for (const v of values) {
    const t = cleanText(v);
    if (t) return t;
  }
  return '';
}

/** Quebra um texto ou lista em itens, tirando marcadores e numeração. */
export function toItems(value: unknown): string[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\n|(?:^|\s)•\s/)
      : [];
  return raw
    .map((v) => {
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return cleanText(o.descricao ?? o.nome ?? o.exame ?? o.acao ?? o.texto ?? '');
      }
      return cleanText(v);
    })
    .map((t) => t.replace(/^\s*(?:[-•*–→]|\d{1,2}[.)])\s*/, '').trim())
    .filter(Boolean);
}

const SEXO: Record<string, string> = { M: 'Masculino', F: 'Feminino', m: 'Masculino', f: 'Feminino' };

export function formatIdade(idade: unknown): string {
  const t = cleanText(idade);
  if (!t) return '';
  return /^\d{1,3}$/.test(t) ? `${t} anos` : t;
}

const VITAL_LABELS: [RegExp, string][] = [
  [/^(pa|press[aã]o)/i, 'Pressão arterial'],
  [/^(fc|frequ[eê]ncia card)/i, 'Freq. cardíaca'],
  [/^(fr|frequ[eê]ncia resp)/i, 'Freq. respiratória'],
  [/^(spo2|sato2|sat|satura)/i, 'Saturação O2'],
  [/^(temp|tax|tax\.)/i, 'Temperatura'],
  [/^peso/i, 'Peso'],
  [/^altura/i, 'Altura'],
  [/^imc/i, 'IMC'],
  [/^(glic|hgt|dextro)/i, 'Glicemia'],
];

function normalizeVitals(raw: unknown): { label: string; value: string }[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const out: { label: string; value: string; order: number }[] = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const value = cleanText(v);
    if (!value) continue;
    const idx = VITAL_LABELS.findIndex(([re]) => re.test(k));
    out.push({ label: idx >= 0 ? VITAL_LABELS[idx][1] : k, value, order: idx >= 0 ? idx : 99 });
  }
  return out.sort((a, b) => a.order - b.order).map(({ label, value }) => ({ label, value }));
}

function normalizeCid(raw: unknown): { codigo: string; descricao?: string }[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: { codigo: string; descricao?: string }[] = [];
  for (const c of raw) {
    let codigo = '';
    let descricao = '';
    if (typeof c === 'string') {
      const m = c.match(/^\s*([A-Z]\d{2}(?:\.\d{1,2})?)\s*[-–:]?\s*(.*)$/i);
      codigo = m ? m[1].toUpperCase() : c.trim();
      descricao = m ? m[2] : '';
    } else if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      codigo = cleanText(o.codigo ?? o.code ?? o.cid ?? '');
      descricao = cleanText(o.descricao ?? o.description ?? o.nome ?? '');
    }
    if (!codigo || seen.has(codigo)) continue;
    seen.add(codigo);
    out.push(descricao ? { codigo, descricao: cleanText(descricao) } : { codigo });
  }
  return out;
}

export function normalizeForCompare(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function formatDate(iso: unknown): string {
  const d = iso ? new Date(String(iso)) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// deno-lint-ignore no-explicit-any
type AnyLaudo = Record<string, any>;

/**
 * Monta o laudo para o PDF. Devolve null para registros de sessão (CRP),
 * que continuam no formato próprio.
 */
export function ageFromBirthDate(birth: unknown, today = new Date()): string {
  const b = birth ? new Date(String(birth)) : null;
  if (!b || Number.isNaN(b.getTime())) return '';
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? `${age} anos` : '';
}

export function buildLaudoDocument(
  laudo: AnyLaudo,
  opts: { patientName?: string | null; patientRecord?: { sex?: string | null; birth_date?: string | null; allergies?: unknown } | null } = {},
): LaudoDocument | null {
  const s: AnyLaudo = laudo.sections || {};
  if (s.conselho === 'CRP') return null;
  const sum: AnyLaudo = laudo.summary?.anamnese || {};
  const p: AnyLaudo = laudo.patient_data || {};
  const ctx: AnyLaudo = laudo.clinical_context || {};
  const h: AnyLaudo = laudo.hypotheses || {};
  const spec: AnyLaudo = s.specialty_sections || {};

  const nome = pick(opts.patientName, p.nome_completo, p.nome, s.identificacao?.nome, p.iniciais) || 'Paciente';
  const rec = opts.patientRecord || {};
  const sexoRaw = pick(p.sexo, s.identificacao?.sexo, rec.sex);
  const paciente = {
    nome,
    idade: formatIdade(p.idade || s.identificacao?.idade) || ageFromBirthDate(rec.birth_date) || undefined,
    sexo: (SEXO[sexoRaw] || sexoRaw) || undefined,
  };

  const alergiasLaudo = toItems(p.alergias).length ? p.alergias : ctx.allergies;
  const alergias = toItems(toItems(alergiasLaudo).length ? alergiasLaudo : rec.allergies).map((a) => a.charAt(0).toLocaleUpperCase('pt-BR') + a.slice(1));
  const sinaisVitais = normalizeVitals(p.sinais_vitais ?? ctx.vitals);
  const blocks: LaudoBlock[] = [];

  // Modelos personalizados: segue exatamente as seções do modelo.
  if (s.modelo_campos && Array.isArray(s.modelo_secoes_def)) {
    for (const def of s.modelo_secoes_def) {
      const text = cleanText(s.modelo_campos[def.chave]);
      if (!text) continue;
      const title = cleanText(def.rotulo) || 'Seção';
      if (def.chave === 'cid10') {
        blocks.push({ kind: 'hypotheses', title, diferenciais: [], cid10: normalizeCid(text.split(/[,;\n]/)) });
      } else if (/conduta|exame|prescri/.test(def.chave) && toItems(text).length > 1) {
        blocks.push({ kind: /exame/.test(def.chave) ? 'checklist' : 'steps', title, items: toItems(text) });
      } else {
        blocks.push({ kind: 'text', title, text });
      }
    }
  } else {
    const anamnese = [
      { label: 'Queixa principal', text: pick(s.queixa, sum.queixa_principal, p.queixa_principal, ctx.chief_complaint) },
      { label: 'História da doença atual', text: pick(s.hda, sum.hda, laudo.summary?.resumo_clinico) },
      { label: 'Interrogatório sistemático', text: pick(s.isda, sum.isda) },
      { label: 'Antecedentes pessoais', text: pick(s.antecedentes_pessoais, s.historico, sum.antecedentes_pessoais, p.historico, ctx.historico) },
      { label: 'Antecedentes familiares', text: pick(s.antecedentes_familiares, sum.antecedentes_familiares) },
      { label: 'Hábitos de vida', text: pick(s.habitos_de_vida, sum.habitos_de_vida) },
      { label: 'Medicações em uso', text: pick(s.medicacoes_em_uso, sum.medicacoes_em_uso, toItems(p.medicacoes).join('; ')) },
    ].filter((i) => i.text);
    if (anamnese.length) blocks.push({ kind: 'fields', title: 'Anamnese', items: anamnese });

    const exame = pick(s.exame_fisico, sum.exame_fisico, ctx.exam_findings);
    const vitaisTexto = sinaisVitais.length ? '' : pick(s.sinais_vitais_texto, sum.sinais_vitais_texto);
    const exameItems = [
      ...(vitaisTexto ? [{ label: 'Sinais vitais', text: vitaisTexto }] : []),
      ...(exame ? [{ label: sinaisVitais.length || vitaisTexto ? 'Achados do exame' : '', text: exame }] : []),
    ];
    if (exameItems.length) blocks.push({ kind: 'fields', title: 'Exame físico', items: exameItems });

    const principalTitulo = pick(s.hipoteses?.principal, h.mais_provavel?.descricao, laudo.diagnosis_main);
    const diferencialTitulo = pick(s.hipoteses?.diferencial, h.menos_provavel?.descricao, laudo.diagnosis_diff);
    const cid10 = normalizeCid(laudo.cid10_codes?.length ? laudo.cid10_codes : s.cid10);
    if (principalTitulo || diferencialTitulo || cid10.length) {
      blocks.push({
        kind: 'hypotheses',
        title: 'Hipótese diagnóstica',
        principal: principalTitulo ? { titulo: principalTitulo, detalhe: cleanText(h.mais_provavel?.racional) || undefined } : undefined,
        diferenciais: diferencialTitulo ? [{ titulo: diferencialTitulo, detalhe: cleanText(h.menos_provavel?.racional) || undefined }] : [],
        cid10,
      });
    }

    const exames = toItems(s.exames_complementares).length ? toItems(s.exames_complementares) : toItems(laudo.complementary_exams);
    if (exames.length) blocks.push({ kind: 'checklist', title: 'Exames solicitados', items: exames });

    let conduta = toItems(s.conduta).length ? toItems(s.conduta) : toItems(laudo.conducts);
    let retorno = pick(s.retorno, spec.retorno);
    if (retorno) {
      // Mesmo texto do retorno já listado na conduta: mostra uma vez só, em destaque.
      const r = normalizeForCompare(retorno);
      const same = (c: string) => [r, normalizeForCompare(`retorno ${retorno}`)].includes(normalizeForCompare(c));
      if (conduta.some(same)) conduta = conduta.filter((c) => !same(c));
      else if (conduta.some((c) => normalizeForCompare(c).includes(r))) retorno = '';
    }
    if (conduta.length) blocks.push({ kind: 'steps', title: 'Conduta e orientações', items: conduta });
    if (retorno) blocks.push({ kind: 'callout', tone: 'info', title: 'Retorno', text: retorno });

    const embasamento = pick(
      s.embasamento_teorico,
      typeof h.embasamento_teorico === 'object' ? h.embasamento_teorico?.fundamentacao : h.embasamento_teorico,
    );
    if (embasamento) blocks.push({ kind: 'text', title: 'Embasamento clínico', text: embasamento, small: true });
  }

  const avisos = pick(s.avisos_legais_clinicos);
  if (avisos) blocks.push({ kind: 'callout', tone: 'warning', title: 'Avisos clínicos', text: avisos });

  return {
    titulo: s.modelo_campos ? pick(s.modelo_nome) || 'Laudo médico' : 'Laudo médico',
    numero: String(laudo.id || '').slice(0, 8).toUpperCase(),
    dataConsulta: formatDate(laudo.created_at),
    paciente,
    alergias,
    sinaisVitais,
    blocks,
    disclaimer: DISCLAIMER_LAUDO,
  };
}
