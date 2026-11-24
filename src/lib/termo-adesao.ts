/**
 * Termo de adesão que o médico assina ao entrar no MindMed.
 * Mudou o texto? Troque a versão: todos assinam de novo no próximo acesso.
 */
export const TERMO_VERSAO = '2026-11-24';

export const TERMO_SECOES: { titulo: string; texto: string[] }[] = [
  {
    titulo: '1. O que é o MindMed',
    texto: [
      'O MindMed é uma ferramenta de documentação clínica. A inteligência artificial transcreve a consulta e organiza um rascunho de laudo, receita e demais documentos.',
      'A IA não faz diagnóstico, não prescreve e não substitui o julgamento do profissional. Todo conteúdo gerado é uma sugestão até ser revisado por você.',
    ],
  },
  {
    titulo: '2. Sua responsabilidade profissional',
    texto: [
      'Você é o único responsável pelo conteúdo clínico de todo documento que revisar, editar, salvar, assinar, imprimir, copiar ou baixar no MindMed, nos termos do Código de Ética Médica e das normas do seu conselho profissional.',
      'Ao copiar um trecho, baixar ou imprimir um documento, você assume a responsabilidade pelo uso desse conteúdo fora do MindMed.',
    ],
  },
  {
    titulo: '3. Dados dos seus pacientes (LGPD)',
    texto: [
      'Você é o controlador dos dados dos seus pacientes e o MindMed atua como operador, tratando esses dados apenas para gerar e guardar a sua documentação (Lei nº 13.709/2018).',
      'São tratados: nome completo, CPF, data de nascimento, sexo, contato, áudio e transcrição da consulta, histórico, exames, imagens, hipóteses, condutas e prescrições.',
      'Cabe a você informar o paciente e obter o consentimento dele antes de gravar a consulta. A transcrição e a organização do texto usam provedores de IA contratados pelo MindMed, que recebem apenas o necessário para executar essa tarefa.',
      'Os dados ficam em servidores com criptografia, com acesso restrito a você (e à sua clínica, quando houver). Você pode pedir acesso, correção, portabilidade ou exclusão a qualquer momento.',
    ],
  },
  {
    titulo: '4. Registro das suas ações (trilha de auditoria)',
    texto: [
      'Para proteger você e seus pacientes, o MindMed registra em seu nome cada cópia, download, impressão, assinatura e salvamento de documentos: data, hora, endereço de internet, navegador e uma impressão digital (código SHA-256) do conteúdo.',
      'Esses registros não podem ser alterados nem apagados e podem ser usados como prova da autoria e da integridade dos documentos.',
    ],
  },
  {
    titulo: '5. Assinatura digital',
    texto: [
      'Quando você usar seu certificado digital ICP-Brasil, os documentos baixados saem assinados por você, com validade jurídica (MP nº 2.200-2/2001 e Lei nº 14.063/2020).',
      'O certificado e a senha são pessoais e intransferíveis. O arquivo e a senha ficam só no seu computador e nunca são enviados ao MindMed. Não permita que outra pessoa assine por você.',
    ],
  },
  {
    titulo: '6. Conta, planos e cancelamento',
    texto: [
      'Você declara ser profissional de saúde com registro ativo no seu conselho e que os dados do seu cadastro são verdadeiros. Sua senha é pessoal.',
      'Os planos e preços são os exibidos no momento da contratação. Você pode cancelar a qualquer momento pelo próprio app, com efeito ao fim do período pago.',
    ],
  },
];

export const TERMO_ITENS = [
  {
    id: 'termos_uso_privacidade',
    texto: 'Li e aceito os Termos de Uso e a Política de Privacidade do MindMed.',
  },
  {
    id: 'responsabilidade_profissional',
    texto: 'Sou o único responsável pelo conteúdo clínico de tudo que eu revisar, salvar, assinar, copiar, imprimir ou baixar no MindMed. A IA apenas apoia a documentação.',
  },
  {
    id: 'dados_pacientes',
    texto: 'Sou o controlador dos dados dos meus pacientes e vou obter o consentimento deles antes de gravar a consulta, conforme a LGPD.',
  },
  {
    id: 'registro_atividades',
    texto: 'Concordo que o MindMed registre em meu nome cada cópia, download, impressão, assinatura e salvamento, com data, hora, endereço de internet e impressão digital do conteúdo.',
  },
  {
    id: 'certificado_pessoal',
    texto: 'Meu certificado digital e minha senha são pessoais e intransferíveis.',
  },
] as const;

/** Texto exato assinado, usado para gerar a impressão digital guardada no aceite. */
export function termoTextoCanonico(): string {
  return JSON.stringify({ versao: TERMO_VERSAO, secoes: TERMO_SECOES, itens: TERMO_ITENS });
}

/** Nome completo: pelo menos duas palavras com 2+ letras. */
export function nomeCompletoValido(nome: string): boolean {
  const partes = nome.trim().split(/\s+/).filter((p) => p.replace(/[^\p{L}]/gu, '').length >= 2);
  return partes.length >= 2;
}
