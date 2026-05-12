export type TeleconsultaStatus =
  | "agendada"
  | "sala_aberta"
  | "em_andamento"
  | "concluida"
  | "cancelada"
  | "nao_compareceu";

export interface Teleconsulta {
  id: string;
  organization_id: string;
  doctor_id: string;
  appointment_id: string | null;
  patient_id: string | null;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  patient_cpf: string | null;
  room_name: string;
  room_url: string;
  doctor_token: string | null;
  patient_token: string | null;
  daily_room_id: string | null;
  status: TeleconsultaStatus;
  scheduled_at: string | null;
  room_opened_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  doctor_consent_at: string | null;
  patient_consent_at: string | null;
  patient_consent_ip: string | null;
  chief_complaint: string | null;
  notes_during_call: string | null;
  prescription_during_call: unknown | null;
  transcript_text: string | null;
  laudo_id: string | null;
  diagnosis_summary: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface TeleconsultaMessage {
  id: string;
  teleconsulta_id: string;
  sender_role: "doctor" | "patient";
  sender_name: string;
  content: string;
  created_at: string;
}

export const TELECONSULTA_STATUS_LABEL: Record<TeleconsultaStatus, string> = {
  agendada: "Agendada",
  sala_aberta: "Sala Aberta",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
  nao_compareceu: "Não Compareceu",
};

export const TELECONSULTA_STATUS_COLOR: Record<TeleconsultaStatus, string> = {
  agendada: "bg-blue-100 text-blue-700 border-blue-200",
  sala_aberta: "bg-amber-100 text-amber-700 border-amber-200",
  em_andamento: "bg-green-100 text-green-700 border-green-200 animate-pulse",
  concluida: "bg-gray-100 text-gray-600 border-gray-200",
  cancelada: "bg-red-100 text-red-600 border-red-200",
  nao_compareceu: "bg-orange-100 text-orange-700 border-orange-200",
};
