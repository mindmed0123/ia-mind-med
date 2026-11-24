/**
 * Preenchimento de um item de receita a partir do catálogo de medicamentos.
 * Usado pelo Receituário e pela aba Receita do laudo para que os dois
 * preencham exatamente os mesmos campos.
 */

export interface CatalogMedication {
  id?: string;
  nome_comercial: string;
  principio_ativo?: string | null;
  concentracao?: string | null;
  apresentacao?: string | null;
  posologia_referencia?: string | null;
  tarja?: string | null;
  tipo_receita?: string | null;
  parceiro_nome?: string | null;
  is_parceiro?: boolean | null;
  registro_anvisa?: string | null;
}

const UNIT = '(mg\\/ml|mg\\/g|mcg|µg|mg|g|ml|ui|%)';
const NUM = '\\d+(?:[.,]\\d+)?(?:\\s*\\+\\s*\\d+(?:[.,]\\d+)?)?';

/**
 * Extrai as doses disponíveis de um texto do catálogo.
 * "Comprimido 25, 50 e 100 mg" → ["25 mg", "50 mg", "100 mg"]
 * "250-400mg" → ["250 mg", "400 mg"]
 */
export function parseDoseOptions(...texts: Array<string | null | undefined>): string[] {
  // Usa o texto que lista mais doses (a apresentação costuma ser mais completa que a faixa).
  let best: string[] = [];
  for (const t of texts) {
    const opts = parseOne(t);
    if (opts.length > best.length) best = opts;
  }
  return best;
}

function parseOne(raw: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const group = new RegExp(`((?:${NUM}\\s*(?:,|;|\\/|-|–|e|ou)\\s*)*${NUM})\\s*${UNIT}(?![a-z])`, 'gi');
  if (!raw) return out;
  {
    for (const m of raw.matchAll(group)) {
      const unit = m[2].toLowerCase() === 'ui' ? 'UI' : m[2].toLowerCase();
      const nums = m[1].split(/\s*(?:,(?!\d)|;|\/|-|–|\be\b|\bou\b)\s*/i).map((n) => n.trim()).filter(Boolean);
      for (const n of nums) {
        if (!/\d/.test(n)) continue;
        const value = `${n.replace(/\s*\+\s*/g, '+')} ${unit}`;
        const key = value.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(value);
        }
      }
    }
  }
  return out;
}

/** Campos do item preenchidos ao escolher um medicamento do catálogo. */
export function fillFromCatalog(med: CatalogMedication) {
  const doseOptions = parseDoseOptions(med.concentracao, med.apresentacao);
  return {
    medicamento: med.nome_comercial,
    // Só preenche a dose quando ela é única; com várias, o médico escolhe.
    dosagem: doseOptions.length === 1 ? doseOptions[0] : '',
    posologia: (med.posologia_referencia || '').trim(),
    principio_ativo: med.principio_ativo ?? null,
    tarja: med.tarja ?? null,
    tipo_receita: med.tipo_receita ?? null,
    parceiro: med.parceiro_nome ?? null,
    registro_anvisa: med.registro_anvisa ?? null,
    doseOptions,
  };
}

/** "105831071" → "1.0583.1071" (formato do registro na ANVISA). */
export function formatAnvisaRegistro(reg: string | null | undefined): string | null {
  const d = (reg || '').replace(/\D/g, '');
  if (d.length === 9) return `${d[0]}.${d.slice(1, 5)}.${d.slice(5)}`;
  if (d.length === 13) return `${d[0]}.${d.slice(1, 5)}.${d.slice(5, 9)}.${d.slice(9, 12)}-${d.slice(12)}`;
  return d || null;
}
