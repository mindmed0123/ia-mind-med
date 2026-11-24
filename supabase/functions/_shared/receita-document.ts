/**
 * Estrutura da receita para o PDF (compartilhada entre generate-prescription-pdf e o app).
 * Só organiza o que o médico salvou; a classificação de cada remédio chega pronta.
 */
import { ageFromBirthDate, cleanText, normalizeForCompare } from './laudo-document.ts';

export type TipoReceita = 'branca_comum' | 'antimicrobiano' | 'controle_especial' | 'azul_b' | 'amarela_a';

export const RECEITA_TIPOS: Record<TipoReceita, { titulo: string; subtitulo: string; controlado: boolean }> = {
  branca_comum: { titulo: 'Receita simples', subtitulo: 'Uso conforme orientação médica', controlado: false },
  antimicrobiano: { titulo: 'Receita de antimicrobiano', subtitulo: 'Retenção da 1ª via na farmácia · RDC 471/2021', controlado: true },
  controle_especial: { titulo: 'Receita de controle especial', subtitulo: 'Portaria SVS/MS 344/1998 · 2 vias', controlado: true },
  azul_b: { titulo: 'Notificação de Receita B', subtitulo: 'Portaria SVS/MS 344/1998', controlado: true },
  amarela_a: { titulo: 'Notificação de Receita A', subtitulo: 'Portaria SVS/MS 344/1998', controlado: true },
};

export interface ReceitaItem {
  nome: string;
  laboratorio?: string;
  dosagem?: string;
  posologia?: string;
  duracao?: string;
  observacoes?: string;
}

export interface ReceitaPagina {
  tipo: TipoReceita;
  titulo: string;
  subtitulo: string;
  via?: string;
  controlado: boolean;
  itens: ReceitaItem[];
}

export interface ReceitaDocument {
  numero: string;
  dataEmissao: string;
  paciente: { nome: string; idade?: string; sexo?: string; prontuario?: string };
  paginas: ReceitaPagina[];
  observacoes?: string;
  rodapeMedico?: string;
  disclaimer: string;
}

export const DISCLAIMER_RECEITA =
  'Documento estruturado com auxílio de inteligência artificial e revisado pelo médico responsável.';

const SEXO: Record<string, string> = { M: 'Masculino', F: 'Feminino', m: 'Masculino', f: 'Feminino' };

const contains = (haystack: string, needle: string) => {
  const n = normalizeForCompare(needle);
  return !!n && ` ${normalizeForCompare(haystack)} `.includes(` ${n} `);
};

// deno-lint-ignore no-explicit-any
type Any = Record<string, any>;

export function buildReceitaItem(raw: Any): ReceitaItem | null {
  const nome = cleanText(raw.medicamento);
  if (!nome) return null;
  const lab = cleanText(raw.parceiro);
  const dosagem = cleanText(raw.dosagem);
  return {
    nome,
    // Evita "Dipirona EMS · EMS" e "Losartana 50 mg · 50 mg".
    laboratorio: lab && !contains(nome, lab) ? lab : undefined,
    dosagem: dosagem && !contains(nome, dosagem) ? dosagem : undefined,
    posologia: cleanText(raw.posologia) || undefined,
    duracao: cleanText(raw.duracao) || undefined,
    observacoes: cleanText(raw.observacoes) || undefined,
  };
}

export function buildReceitaDocument(
  prescription: Any,
  groups: { tipo: TipoReceita; items: Any[] }[],
  opts: { rodapeMedico?: string | null; today?: Date } = {},
): ReceitaDocument {
  const paginas: ReceitaPagina[] = [];
  for (const g of groups) {
    const info = RECEITA_TIPOS[g.tipo] || RECEITA_TIPOS.branca_comum;
    const itens = g.items.map(buildReceitaItem).filter((i): i is ReceitaItem => !!i);
    if (!itens.length) continue;
    const base = { tipo: g.tipo, titulo: info.titulo, subtitulo: info.subtitulo, controlado: info.controlado, itens };
    if (info.controlado) {
      paginas.push({ ...base, via: '1ª via · Farmácia' }, { ...base, via: '2ª via · Paciente' });
    } else {
      paginas.push(base);
    }
  }

  const created = prescription.created_at ? new Date(String(prescription.created_at)) : new Date();
  const sexoRaw = cleanText(prescription.patient_sex);
  return {
    numero: String(prescription.id || '').slice(0, 8).toUpperCase(),
    dataEmissao: Number.isNaN(created.getTime())
      ? ''
      : created.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' }),
    paciente: {
      nome: cleanText(prescription.patient_name) || 'Paciente',
      idade: ageFromBirthDate(prescription.patient_dob, opts.today) || undefined,
      sexo: (SEXO[sexoRaw] || sexoRaw) || undefined,
      prontuario: cleanText(prescription.patient_id_external) || undefined,
    },
    paginas,
    observacoes: cleanText(prescription.notes) || undefined,
    rodapeMedico: cleanText(opts.rodapeMedico) || undefined,
    disclaimer: DISCLAIMER_RECEITA,
  };
}
