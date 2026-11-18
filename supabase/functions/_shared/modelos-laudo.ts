export type ModeloLaudo = {
  id: string;
  nome: string;
  descricao: string;
  inferencia: boolean;
  secoes: { chave: string; rotulo: string; descricao: string }[];
};

const secoes = (items: [string, string][]) => items.map(([chave, rotulo]) => ({ chave, rotulo, descricao: `Conteúdo de ${rotulo}, somente conforme ditado pelo médico.` }));
export const MODELOS_LAUDO: ModeloLaudo[] = [
  { id: 'padrao', nome: 'Completo', descricao: 'Laudo completo com hipóteses e sugestões para revisão médica.', inferencia: true, secoes: secoes([['anamnese','Anamnese'],['hipotese_principal','Hipótese principal'],['hipotese_diferencial','Diagnóstico diferencial'],['condutas','Conduta'],['exames','Exames'],['cid10','CID-10'],['prescricoes_sugeridas','Prescrições']]) },
  { id: 'soap', nome: 'Consulta (SOAP)', descricao: 'Subjetivo, objetivo, avaliação e plano — apenas o que foi ditado.', inferencia: false, secoes: secoes([['subjetivo','Subjetivo — queixa e história relatadas pelo paciente'],['objetivo','Objetivo — exame físico e dados objetivos ditados'],['avaliacao','Avaliação — o que o médico concluiu em voz alta'],['plano','Plano — conduta ditada']]) },
  { id: 'anamnese', nome: 'Primeira consulta', descricao: 'História clínica e exame físico, sem completar lacunas.', inferencia: false, secoes: secoes([['identificacao','Identificação'],['queixa_principal','Queixa principal'],['hda','História da doença atual'],['antecedentes_pessoais','Antecedentes pessoais'],['antecedentes_familiares','Antecedentes familiares'],['habitos','Hábitos e condições de vida'],['revisao_sistemas','Revisão de sistemas'],['exame_fisico','Exame físico'],['avaliacao','Avaliação'],['conduta','Conduta']]) },
  { id: 'evolucao', nome: 'Retorno', descricao: 'Evolução, exame dirigido, ajuste de conduta e retorno ditados.', inferencia: false, secoes: secoes([['evolucao','Evolução desde o último atendimento'],['exame_dirigido','Exame dirigido'],['ajuste_conduta','Ajuste de conduta'],['retorno','Retorno']]) },
  { id: 'exame', nome: 'Laudo de exame ou procedimento', descricao: 'Indicação, técnica, achados e conclusão ditados pelo médico.', inferencia: false, secoes: secoes([['identificacao','Identificação'],['indicacao','Indicação'],['tecnica','Técnica'],['achados','Achados descritos pelo médico'],['conclusao','Conclusão ditada pelo médico']]) },
];
export const SCOPE_VERSION = 'modelos-2026-10';
export const AVISO_INFERENCIA = 'Este modelo pode incluir conteúdo sugerido pelo sistema. Revise cada campo antes de assinar.';
export const REGRA_DOCUMENTAL = `REGRA ABSOLUTA DESTE MODELO: você nunca produz informação clínica que não
esteja na transcrição. Não complete lacunas. Não aplique diretriz. Não
sugira tratamento de primeira linha. Não proponha hipótese a partir de
sintomas. Campo sem correspondente no áudio fica vazio. É preferível
devolver campo vazio a devolver conteúdo inferido.`;

export function modeloBase(id?: string | null): ModeloLaudo {
  return MODELOS_LAUDO.find(m => m.id === id) || MODELOS_LAUDO[0];
}
export function customModelo(row: { id: string; nome: string; base: string; secoes: unknown }): ModeloLaudo {
  const base = modeloBase(row.base);
  if (!Array.isArray(row.secoes) || row.secoes.length < 1 || row.secoes.length > 30) throw new Error('Seções inválidas');
  const seen = new Set<string>();
  const fields = row.secoes.map((s: any) => {
    if (!s || typeof s.chave !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(s.chave) || seen.has(s.chave) || typeof s.rotulo !== 'string' || !s.rotulo.trim() || s.rotulo.length > 150) throw new Error('Seção inválida');
    seen.add(s.chave);
    return { chave: s.chave, rotulo: s.rotulo.trim(), descricao: `Conteúdo de ${s.rotulo.trim()}.` };
  });
  return { id: row.id, nome: row.nome, descricao: `Personalizado a partir de ${base.nome}`, inferencia: base.inferencia, secoes: fields };
}
export function buildModeloTool(modelo: ModeloLaudo, original: any) {
  const tool = JSON.parse(JSON.stringify(original));
  if (modelo.id === 'padrao') return tool;
  if (modelo.inferencia) {
    tool.function.parameters.properties.modelo_secoes = { type: 'object', properties: Object.fromEntries(modelo.secoes.map(s => [s.chave, { type: 'string', description: s.descricao }])), additionalProperties: false };
    return tool;
  }
  const rx = { ...tool.function.parameters.properties.prescricoes_sugeridas, minItems: 0, description: 'Somente medicamentos explicitamente prescritos pelo médico. Vazio se nenhum foi ditado.' };
  rx.items.properties.origem = { type: 'string', enum: ['mencionada'] };
  delete rx.items.required;
  rx.items.properties.observacoes = { type: 'string', description: 'Somente observações ditadas.' };
  tool.function.parameters = {
    type: 'object', additionalProperties: false,
    properties: {
      ...Object.fromEntries(modelo.secoes.map(s => [s.chave, { type: 'string', description: `${s.descricao} Campo vazio se não mencionado; não inferir.` }])),
      dados_paciente_extraidos: { type: 'object', properties: { nome_completo: { type: 'string' }, idade: { type: 'string' }, sexo: { type: 'string' } }, additionalProperties: false },
      prescricoes_sugeridas: rx,
    },
  };
  return tool;
}
export function modeloPrompt(modelo: ModeloLaudo, original: string) {
  if (modelo.inferencia) return original.replace(/red[ _]flags/gi, '').replace(/sinais de alerta/gi, '') + (modelo.id !== 'padrao' ? `\nOrganize também modelo_secoes nas seguintes seções: ${JSON.stringify(modelo.secoes)}.` : '');
  return `Você documenta consultas médicas em PT-BR. Organize exclusivamente a transcrição nas seções: ${JSON.stringify(modelo.secoes)}. Dados do paciente e medicamentos só quando ditados. Não use perfil, histórico externo, diretrizes ou sintomas para inferir conteúdo. Não transforme medicamentos em uso em nova prescrição.\n${REGRA_DOCUMENTAL}`;
}
export function modeloSnapshot(modelo: ModeloLaudo & { parceiro_slug?: string }) {
  return { modelo_id: modelo.id, modelo_nome: modelo.nome, inferencia: modelo.inferencia, scope_version: SCOPE_VERSION, modelo_secoes_def: modelo.secoes, ...(modelo.parceiro_slug ? { parceiro_slug: modelo.parceiro_slug } : {}) };
}
export function normalizeModeloFields(modelo: ModeloLaudo, data: Record<string, any>) {
  return Object.fromEntries(modelo.secoes.map(s => [s.chave, typeof data[s.chave] === 'string' ? data[s.chave] : '']));
}
export function modeloMarkdown(modelo: ModeloLaudo, fields: Record<string, string>) {
  return modelo.secoes.map(s => `## ${s.rotulo}\n\n${fields[s.chave] || ''}`).join('\n\n');
}