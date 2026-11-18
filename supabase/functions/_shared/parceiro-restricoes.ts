// Catálogo de parceiros sem dependência de secrets ou do runtime Deno:
// usado pela resolução de modelo no servidor, pela interface e pelos testes.
// A restrição não pode depender de um cupom configurado — ela é condição contratual.
// Mantenha a lista de restritos igual à função SQL public.parceiro_somente_documentacao.
import { modeloBase, type ModeloLaudo } from './modelos-laudo.ts';

export type InfoParceiro = { rotulo: string; slug: string; somenteDocumentacao: boolean };

export const CATALOGO_PARCEIROS: Record<string, InfoParceiro> = {
  sbacv: { rotulo: 'SBACV', slug: 'sbacv', somenteDocumentacao: false },
  sindmepa: { rotulo: 'SINDMEPA', slug: 'sindmepa', somenteDocumentacao: true },
};

/** Modelo de documentação usado quando uma conta restrita pede um modelo com inferência. */
export const MODELO_DOCUMENTACAO_PARCEIRO = 'soap';
export const AVISO_COMPLETO_INDISPONIVEL = 'Modelo Completo indisponível nas contas do convênio.';

export function infoParceiroPorSlug(slug?: string | null): InfoParceiro | undefined {
  if (typeof slug !== 'string' || !slug) return undefined;
  return CATALOGO_PARCEIROS[slug];
}

export function somenteDocumentacao(slug?: string | null): boolean {
  return !!infoParceiroPorSlug(slug)?.somenteDocumentacao;
}

/** Última palavra na resolução: conta restrita nunca recebe modelo com inferência. */
export function aplicarRestricaoParceiro(modelo: ModeloLaudo, slug?: string | null): ModeloLaudo {
  if (!somenteDocumentacao(slug) || !modelo.inferencia) return modelo;
  if (modelo.id === 'padrao') return modeloBase(MODELO_DOCUMENTACAO_PARCEIRO);
  return { ...modelo, inferencia: false };
}
