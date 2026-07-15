export const VIAS_ADMINISTRACAO = [
  'Oral', 'Intravenosa', 'Intramuscular', 'Subcutânea', 'Tópica',
  'Inalatória', 'Oftálmica', 'Retal', 'Outra',
] as const;

export const TIPOS_NOTIFICACAO = [
  'Suspeita de reação adversa',
  'Inefetividade terapêutica',
  'Erro de medicação',
  'Uso off-label',
  'Intoxicação',
  'Abuso/overdose',
  'Superdosagem',
  'Exposição acidental',
  'Exposição ocupacional',
  'Exposição gestacional/lactacional',
  'Interação medicamentosa',
  'Desvio de qualidade',
  'Efeito benéfico inesperado',
] as const;

export const RECUPERACAO_OPCOES = ['Sim', 'Não', 'Em recuperação', 'Não sabe'] as const;

export const CRITERIOS_GRAVIDADE = [
  'Óbito',
  'Risco de vida',
  'Hospitalização ou prolongamento',
  'Incapacidade persistente',
  'Anomalia congênita',
  'Outro evento clinicamente relevante',
] as const;

export const STEPS = [
  { id: 1, label: 'Relator' },
  { id: 2, label: 'Paciente' },
  { id: 3, label: 'Produto' },
  { id: 4, label: 'Histórico' },
  { id: 5, label: 'Evento' },
  { id: 6, label: 'Revisão' },
] as const;
