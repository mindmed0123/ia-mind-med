/**
 * Classifica medicamentos por tipo de receita conforme RDC 471/2021 (Anvisa)
 * e Portaria SVS/MS 344/1998.
 *
 * Tipos:
 * - branca_comum: receita simples não controlada
 * - antimicrobiano: branca em 2 vias com retenção (RDC 471/2021)
 * - controle_especial: branca em 2 vias (lista C1/C2 — antidepressivos,
 *   anticonvulsivantes, opioides fracos, isotretinoína etc.)
 * - azul_b: notificação de receita B (psicotrópicos B1/B2 — benzodiazepínicos,
 *   zolpidem etc.)
 * - amarela_a: notificação de receita A (entorpecentes A1/A2/A3 — morfina,
 *   metilfenidato, lisdexanfetamina etc.)
 *
 * ⚠️ REGRA DE SEGURANÇA CLÍNICA/LEGAL: a inferência NUNCA pode ser mais
 * permissiva que o mínimo determinado pelo princípio ativo / nome comercial
 * mesmo quando o item veio sem metadados do catálogo (ex.: extraído do áudio).
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

/** Ordem de severidade — quanto maior, mais restritivo. */
const SEVERIDADE: Record<TipoReceita, number> = {
  branca_comum: 0,
  antimicrobiano: 1,
  controle_especial: 2,
  azul_b: 3,
  amarela_a: 4,
};

export interface PrescriptionItemLike {
  medicamento: string;
  dosagem?: string;
  posologia?: string;
  duracao?: string;
  observacoes?: string;
  parceiro?: string | null;
  tarja?: string | null;
  tipo_receita?: string | null;
  principio_ativo?: string | null;
}

/* ─────────────────────────────────────────────────────────────
 * LISTA DE SEGURANÇA (princípio ativo / nome comercial)
 * Match case/acento-insensível, por palavra inteira quando possível.
 * ──────────────────────────────────────────────────────────── */

const normalize = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// A1/A2/A3 — entorpecentes e psicotrópicos anfetamínicos → Receita A (Amarela)
const AMARELA_A_PATTERNS: RegExp[] = [
  /\bmorfina\b/, /\bfentanil\b/, /\bmetadona\b/, /\boxicodona\b/,
  /\bhidromorfona\b/, /\bpetidina\b/, /\bmeperidina\b/, /\bremifentanil\b/,
  /\bsufentanil\b/, /\balfentanil\b/, /\bnalbufina\b/,
  /\bmetilfenidato\b/, /\blisdexanfetamina\b/, /\bdexanfetamina\b/,
  /\banfepramona\b/, /\bfenproporex\b/, /\bmazindol\b/,
  // Marcas
  /\britalina\b/, /\bconcerta\b/, /\bvenvanse\b/, /\bdimesilato\b/,
  /\bdurogesic\b/, /\bdimorf\b/,
];

// B1/B2 — psicotrópicos benzodiazepínicos, análogos e anorexígenos → Azul B
const AZUL_B_PATTERNS: RegExp[] = [
  /\bclonazepam\b/, /\balprazolam\b/, /\bdiazepam\b/, /\bbromazepam\b/,
  /\blorazepam\b/, /\bmidazolam\b/, /\bflunitrazepam\b/, /\bnitrazepam\b/,
  /\btriazolam\b/, /\boxazepam\b/, /\bclobazam\b/, /\bestazolam\b/,
  /\bcloxazolam\b/, /\bclordiazepoxido\b/, /\btemazepam\b/,
  /\bzolpidem\b/, /\bzopiclona\b/, /\bzaleplona\b/, /\beszopiclona\b/,
  /\bbuprenorfina\b/, /\bpentazocina\b/,
  // Marcas
  /\bfrontal\b/, /\brivotril\b/, /\blexotan\b/, /\bvalium\b/,
  /\bstilnox\b/, /\bturno\b/, /\blorax\b/, /\burbanil\b/,
  /\bdormonid\b/, /\bdormire\b/, /\bnoctal\b/,
];

// C1 e C2 — outras substâncias sujeitas a controle especial → Controle Especial
const CONTROLE_ESPECIAL_PATTERNS: RegExp[] = [
  // Opioides fracos (C1)
  /\btramadol\b/, /\bcodeina\b/, /\bcodein\b/,
  /\btylex\b/, /\btramal\b/, /\bultracet\b/, /\bgesico\b/, /\bpaco\b/,
  // Antidepressivos
  /\bsertralina\b/, /\bfluoxetina\b/, /\bparoxetina\b/, /\bcitalopram\b/,
  /\bescitalopram\b/, /\bfluvoxamina\b/,
  /\bvenlafaxina\b/, /\bdesvenlafaxina\b/, /\bduloxetina\b/,
  /\bmilnaciprano\b/, /\bbupropiona\b/, /\bmirtazapina\b/, /\btrazodona\b/,
  /\bamitriptilina\b/, /\bnortriptilina\b/, /\bclomipramina\b/,
  /\bimipramina\b/, /\bagomelatina\b/, /\bvortioxetina\b/,
  // Antipsicóticos
  /\bhaloperidol\b/, /\brisperidona\b/, /\bquetiapina\b/, /\bolanzapina\b/,
  /\baripiprazol\b/, /\bclozapina\b/, /\bziprasidona\b/, /\blurasidona\b/,
  /\bpaliperidona\b/, /\bclorpromazina\b/, /\blevomepromazina\b/,
  /\bsulpirida\b/, /\btiaprid/,
  // Anticonvulsivantes / estabilizadores
  /\blamotrigina\b/, /\bcarbamazepina\b/, /\boxcarbazepina\b/,
  /\bdivalproato\b/, /\bvalproato\b/, /\bvalproic/, /\bacido valproic/,
  /\btopiramato\b/, /\bgabapentina\b/, /\bpregabalina\b/,
  /\blevetiracetam\b/, /\bfenitoina\b/, /\bfenobarbital\b/,
  /\bprimidona\b/, /\bvigabatrina\b/, /\betossuximida\b/, /\btiagabina\b/,
  // Anticolinesterásicos e Alzheimer
  /\bdonepezila\b/, /\brivastigmina\b/, /\bgalantamina\b/, /\bmemantina\b/,
  // Retinoides sistêmicos (C2)
  /\bisotretinoina\b/, /\bacitretina\b/,
];

// Antimicrobianos → RDC 20/2011 → receita branca em 2 vias
const ANTIMICROBIANO_PATTERNS: RegExp[] = [
  /\bamoxicilina\b/, /\bampicilina\b/, /\bpenicilina\b/, /\boxacilina\b/,
  /\bcefalexina\b/, /\bcefadroxil\b/, /\bcefuroxima\b/, /\bcefaclor\b/,
  /\bceftriaxona\b/, /\bcefotaxima\b/, /\bcefepim/, /\bceftazidima\b/,
  /\bciprofloxacino\b/, /\blevofloxacino\b/, /\bmoxifloxacino\b/,
  /\bnorfloxacino\b/, /\bofloxacino\b/, /\bgatifloxacino\b/,
  /\bazitromicina\b/, /\bclaritromicina\b/, /\beritromicina\b/,
  /\broxitromicina\b/, /\bclindamicina\b/, /\blincomicina\b/,
  /\bsulfametoxazol\b/, /\btrimetoprima\b/, /\bbactrim\b/, /\bsulfa\b/,
  /\bmetronidazol\b/, /\btinidazol\b/, /\bsecnidazol\b/, /\bornidazol\b/,
  /\bnitrofurantoina\b/, /\bfosfomicina\b/,
  /\bdoxiciclina\b/, /\btetraciclina\b/, /\bminociclina\b/, /\btigeciclina\b/,
  /\bvancomicina\b/, /\bteicoplanina\b/, /\blinezolida\b/, /\bdaptomicina\b/,
  /\bgentamicina\b/, /\bamicacina\b/, /\btobramicina\b/, /\bestreptomicina\b/,
  /\bmeropenem\b/, /\bimipenem\b/, /\bertapenem\b/, /\baztreonam\b/,
  /\bfluconazol\b/, /\bitraconazol\b/, /\bcetoconazol\b/, /\bvoriconazol\b/,
  /\bposaconazol\b/, /\bterbinafina\b/, /\bgriseofulvina\b/,
  /\baciclovir\b/, /\bvalaciclovir\b/, /\bganciclovir\b/, /\boseltamivir\b/,
  /\brifampicina\b/, /\bisoniazida\b/, /\bpirazinamida\b/, /\betambutol\b/,
  /\brifaximina\b/,
  // Marcas
  /\bkeflex\b/, /\bamoxil\b/, /\bzithromax\b/, /\bcipro\b/, /\btavanic\b/,
  /\bsinot\b/, /\bastro\b/, /\bsubtrax\b/,
];

/**
 * Retorna o tipo MÍNIMO exigido pela lista de segurança para este nome/princípio
 * ativo. Retorna null quando o item não está em nenhuma classe de risco conhecida.
 */
export function inferTipoMinimoPorNome(...campos: (string | null | undefined)[]): TipoReceita | null {
  const alvo = campos
    .filter(Boolean)
    .map((s) => normalize(String(s)))
    .join(' | ');
  if (!alvo) return null;
  if (AMARELA_A_PATTERNS.some((r) => r.test(alvo))) return 'amarela_a';
  if (AZUL_B_PATTERNS.some((r) => r.test(alvo))) return 'azul_b';
  if (CONTROLE_ESPECIAL_PATTERNS.some((r) => r.test(alvo))) return 'controle_especial';
  if (ANTIMICROBIANO_PATTERNS.some((r) => r.test(alvo))) return 'antimicrobiano';
  return null;
}

/** Retorna o mais restritivo entre dois tipos de receita. */
function maxTipo(a: TipoReceita, b: TipoReceita | null | undefined): TipoReceita {
  if (!b) return a;
  return SEVERIDADE[b] > SEVERIDADE[a] ? b : a;
}

/** Infere o tipo de receita combinando metadados do catálogo + lista de segurança. */
export function inferTipoReceita(item: PrescriptionItemLike): TipoReceita {
  // 1) Base a partir dos metadados do catálogo (quando existirem)
  let base: TipoReceita = 'branca_comum';
  const raw = (item.tipo_receita || '').trim().toLowerCase();
  if (raw === 'controle_special') base = 'controle_especial'; // typo guard
  else if (
    raw === 'branca_comum' ||
    raw === 'antimicrobiano' ||
    raw === 'controle_especial' ||
    raw === 'azul_b' ||
    raw === 'amarela_a'
  ) {
    base = raw as TipoReceita;
  } else {
    const tarja = (item.tarja || '').toLowerCase();
    if (tarja === 'preta' || tarja.includes('azul')) base = 'azul_b';
    else if (tarja.includes('amarela')) base = 'amarela_a';
    else if (tarja === 'vermelha_retencao') base = 'controle_especial';
  }

  // 2) Piso de segurança por nome/princípio ativo — NUNCA menos restritivo
  const piso = inferTipoMinimoPorNome(item.medicamento, item.principio_ativo);
  return maxTipo(base, piso);
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
