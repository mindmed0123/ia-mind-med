// Perfil profissional por conselho (CRM / CRP).
// Fonte única das listas de especialidades, disclaimers e regras de UI por conselho.

export type Conselho = 'CRM' | 'CRP';

export const ESPECIALIDADES_CRM: string[] = [
  'Clínica médica',
  'Cardiologia',
  'Dermatologia',
  'Endocrinologia e metabologia',
  'Gastroenterologia',
  'Geriatria',
  'Ginecologia e obstetrícia',
  'Infectologia',
  'Medicina de família e comunidade',
  'Medicina do trabalho',
  'Medicina intensiva',
  'Nefrologia',
  'Neurologia',
  'Nutrologia',
  'Oftalmologia',
  'Oncologia clínica',
  'Ortopedia e traumatologia',
  'Otorrinolaringologia',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Reumatologia',
  'Urologia',
  'Cirurgia geral',
  'Angiologia e cirurgia vascular',
  'Anestesiologia',
  'Radiologia e diagnóstico por imagem',
  'Outra',
];

export const ESPECIALIDADES_CRP: string[] = [
  'Psicologia clínica',
  'Psicologia da saúde',
  'Neuropsicologia',
  'Psicologia hospitalar',
  'Psicologia organizacional e do trabalho',
  'Psicologia escolar e educacional',
  'Psicologia jurídica',
  'Psicologia do esporte',
  'Psicologia social',
  'Outra',
];

export const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export const DISCLAIMER_CRM =
  'Documento elaborado com apoio de sistema de inteligência artificial para transcrição e estruturação. Conteúdo revisado e validado pelo profissional signatário antes da assinatura.';

export const DISCLAIMER_CRP =
  'Registro elaborado com apoio de sistema de inteligência artificial para transcrição e estruturação do conteúdo da sessão. As interpretações, conclusões e a condução técnica são de autoria exclusiva da profissional signatária, que revisou integralmente o conteúdo antes da assinatura.';

// Rótulo do documento principal por conselho
export const docLabel = (conselho: Conselho | null | undefined) =>
  conselho === 'CRP' ? 'Registro de sessão' : 'Laudo';

export const isCRP = (conselho: string | null | undefined) => conselho === 'CRP';

// Retenção mínima (Lei 13.787/2018) para registros de perfil CRP
export const CRP_RETENTION_YEARS = 20;
