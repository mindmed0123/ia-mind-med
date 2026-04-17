import { AppointmentStatus } from "@/hooks/useAppointments";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

export const STATUS_COLOR: Record<AppointmentStatus, string> = {
  scheduled: "hsl(217 91% 60%)",
  confirmed: "hsl(160 84% 39%)",
  in_progress: "hsl(43 96% 56%)",
  completed: "hsl(142 71% 45%)",
  cancelled: "hsl(0 0% 60%)",
  no_show: "hsl(0 84% 60%)",
};

export const STATUS_BADGE_CLASS: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 line-through",
  no_show: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Detecta erro de conflito do Postgres e devolve mensagem clara */
export function parseAppointmentError(err: any): string {
  const msg = err?.message ?? String(err ?? "");
  if (msg.includes("no_doctor_overlap") || msg.includes("conflicting key")) {
    return "Este médico já possui um agendamento neste horário.";
  }
  if (msg.includes("valid_time_range")) {
    return "O horário final deve ser depois do horário inicial.";
  }
  if (msg.toLowerCase().includes("violates row-level security")) {
    return "Você não tem permissão para essa ação.";
  }
  return msg || "Não foi possível concluir a operação.";
}
