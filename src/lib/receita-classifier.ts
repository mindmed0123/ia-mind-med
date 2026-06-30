/**
 * Classifica medicamentos por tipo de receita conforme RDC 471/2021 (Anvisa).
 *
 * Tipos:
 * - branca_comum: receita simples não controlada
 * - antimicrobiano: branca em 2 vias com retenção (RDC 471/2021)
 * - controle_especial: branca em 2 vias (lista C1 — ex.: anticonvulsivantes)
 * - azul_b: notificação de receita B (psicotrópicos, ex.: benzodiazepínicos)
 * - amarela_a: notificação de receita A (entorpecentes, ex.: opioides fortes)
 */

export type TipoReceita =
  | 'branca_comum'
  | 'antimicrobiano'
  | 'controle_especial'
  | 'azul_b'
  | 'amarela_a';

export const TIPO_RECEITA_LABEL: Record<TipoReceita, string> = {
  branca_comum: 'Receita Branca Comum',
  antimicrobiano: 'Receita de Antimicrobiano',
  controle_especial: 'Receita de Controle Especial',
  azul_b: 'Notificação de Receita B (Azul)',
  amarela_a: 'Notificação de Receita A (Amarela)',
};

export const TIPO_RECEITA_SHORT: Record<TipoReceita, string> = {
  branca_comum: 'Branca',
  antimicrobiano: 'Antimicrobiano',
  controle_especial: 'Controle Especial',
  azul_b: 'Azul B',
  amarela_a: 'Amarela A',
};

export const TIPO_RECEITA_COLOR: Record<TipoReceita, string> = {
  branca_comum: 'bg-slate-100 text-slate-700 border-slate-300',
  antimicrobiano: 'bg-orange-100 text-orange-800 border-orange-300',
  controle_especial: 'bg-rose-100 text-rose-800 border-rose-300',
  azul_b: 'bg-blue-100 text-blue-800 border-blue-300',
  amarela_a: 'bg-amber-100 text-amber-900 border-amber-400',
};

export const TIPO_RECEITA_NUM_VIAS: Record<TipoReceita, number> = {
  branca_comum: 1,
  antimicrobiano: 2,
  controle_especial: 2,
  azul_b: 2,
  amarela_a: 2,
};

export interface PrescriptionItemLike {
  medicamento: string;
  dosagem: string;
  posologia: string;
  duracao?: string;
  observacoes?: string;
  parceiro?: string | null;
  tarja?: string | null;
  tipo_receita?: string | null;
}

/** Infere o tipo de receita a partir do item (tipo_receita explícito ou tarja). */
export function inferTipoReceita(item: PrescriptionItemLike): TipoReceita {
  const raw = (item.tipo_receita || '').trim();
  if (raw === 'controle_special') return 'controle_especial'; // typo guard
  if (
    raw === 'branca_comum' ||
    raw === 'antimicrobiano' ||
    raw === 'controle_especial' ||
    raw === 'azul_b' ||
    raw === 'amarela_a'
  ) {
    return raw;
  }
  // Fallback por tarja
  const tarja = (item.tarja || '').toLowerCase();
  if (tarja === 'preta') return 'azul_b';
  if (tarja === 'vermelha_retencao') return 'controle_especial';
  return 'branca_comum';
}

/** Agrupa itens por tipo de receita preservando ordem. */
export function groupByReceita<T extends PrescriptionItemLike>(
  items: T[]
): Array<{ tipo: TipoReceita; items: T[] }> {
  const map = new Map<TipoReceita, T[]>();
  for (const it of items) {
    const tipo = inferTipoReceita(it);
    if (!map.has(tipo)) map.set(tipo, []);
    map.get(tipo)!.push(it);
  }
  // Ordem fixa: branca primeiro, controlados depois
  const order: TipoReceita[] = [
    'branca_comum',
    'antimicrobiano',
    'controle_especial',
    'azul_b',
    'amarela_a',
  ];
  return order
    .filter((t) => map.has(t))
    .map((tipo) => ({ tipo, items: map.get(tipo)! }));
}

export function isControlado(tipo: TipoReceita): boolean {
  return tipo !== 'branca_comum';
}
