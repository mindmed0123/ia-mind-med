export type RiscoHantavirus = "baixo" | "moderado" | "alto" | "critico";
export type StatusTriagem = "pendente" | "concluido" | "salvo_prontuario";

export interface SintomasHantavirus {
  febre: boolean;
  cefaleia: boolean;
  mialgia: boolean;
  dor_lombar: boolean;
  dor_abdominal: boolean;
  nausea: boolean;
  vomito: boolean;
  diarreia: boolean;
  fadiga: boolean;
  rubor_facial: boolean;
  olhos_vermelhos: boolean;
  petequias: boolean;
  tosse_seca: boolean;
  dispneia: boolean;
  hipotensao: boolean;
  taquicardia: boolean;
}

export interface FatoresEpidemiologicos {
  contato_roedores: boolean;
  area_rural: boolean;
  viagem_endemica: boolean;
  contato_caso_confirmado: boolean;
}

export interface TriagemHantavirus {
  id: string;
  organization_id: string;
  doctor_id: string;
  patient_id: string | null;
  patient_name: string;
  sintomas: SintomasHantavirus;
  fatores_epidemiologicos: FatoresEpidemiologicos;
  descricao_sintomas: string | null;
  imagens_manchas: string[];
  probabilidade_hantavirus: number | null;
  classificacao_risco: RiscoHantavirus | null;
  analise_ia: string | null;
  recomendacoes_ia: string[] | null;
  analise_imagem_ia: string | null;
  diferenciais_ia: string[] | null;
  status: StatusTriagem;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export const RISCO_CONFIG: Record<
  RiscoHantavirus,
  { label: string; cor: string; corFundo: string; emoji: string; descricao: string }
> = {
  baixo: {
    label: "Baixo Risco",
    cor: "text-emerald-700",
    corFundo: "bg-emerald-50 border-emerald-300",
    emoji: "✅",
    descricao: "Improvável Hantavírus. Monitorar sintomas.",
  },
  moderado: {
    label: "Risco Moderado",
    cor: "text-amber-700",
    corFundo: "bg-amber-50 border-amber-300",
    emoji: "⚠️",
    descricao: "Suspeita. Solicitar exames laboratoriais e monitorar.",
  },
  alto: {
    label: "Alto Risco",
    cor: "text-red-700",
    corFundo: "bg-red-50 border-red-300",
    emoji: "🚨",
    descricao: "Suspeita forte. Notificar Vigilância Epidemiológica imediatamente.",
  },
  critico: {
    label: "CRÍTICO",
    cor: "text-white",
    corFundo: "bg-red-600 border-red-700 text-white",
    emoji: "🆘",
    descricao: "Caso altamente suspeito. Isolamento e notificação compulsória URGENTE.",
  },
};

export const SINTOMAS_LABELS: Record<keyof SintomasHantavirus, string> = {
  febre: "Febre (≥38°C)",
  cefaleia: "Cefaleia intensa",
  mialgia: "Mialgia (dores musculares)",
  dor_lombar: "Dor lombar",
  dor_abdominal: "Dor abdominal",
  nausea: "Náusea",
  vomito: "Vômito",
  diarreia: "Diarreia",
  fadiga: "Fadiga/prostração",
  rubor_facial: "Rubor facial",
  olhos_vermelhos: "Olhos vermelhos (conjuntivite)",
  petequias: "Petéquias (manchas vermelhas na pele)",
  tosse_seca: "Tosse seca",
  dispneia: "Dispneia (falta de ar)",
  hipotensao: "Hipotensão",
  taquicardia: "Taquicardia",
};

export const FATORES_LABELS: Record<keyof FatoresEpidemiologicos, string> = {
  contato_roedores: "Contato com roedores ou fezes de roedores",
  area_rural: "Trabalho ou residência em área rural/agrícola",
  viagem_endemica: "Viagem recente para área endêmica (Patagônia, Sul do Brasil)",
  contato_caso_confirmado: "Contato com caso confirmado de Hantavírus",
};

export const SINTOMAS_DEFAULT: SintomasHantavirus = {
  febre: false, cefaleia: false, mialgia: false, dor_lombar: false,
  dor_abdominal: false, nausea: false, vomito: false, diarreia: false,
  fadiga: false, rubor_facial: false, olhos_vermelhos: false, petequias: false,
  tosse_seca: false, dispneia: false, hipotensao: false, taquicardia: false,
};

export const FATORES_DEFAULT: FatoresEpidemiologicos = {
  contato_roedores: false, area_rural: false,
  viagem_endemica: false, contato_caso_confirmado: false,
};
