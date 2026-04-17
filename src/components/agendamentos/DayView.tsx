import { useMemo } from "react";
import { Appointment } from "@/hooks/useAppointments";
import { OrgMember } from "@/hooks/useOrganization";
import { STATUS_BADGE_CLASS, STATUS_LABEL, formatTime } from "@/lib/appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  appointments: Appointment[];
  members: OrgMember[];
  onSlotClick: (start: Date) => void;
  onAppointmentClick: (appt: Appointment) => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_MINUTES = 30;
const ROW_HEIGHT = 28; // px per slot

export function DayView({ date, appointments, members, onSlotClick, onAppointmentClick }: Props) {
  const slots = useMemo(() => {
    const arr: Date[] = [];
    const base = new Date(date);
    base.setHours(HOUR_START, 0, 0, 0);
    const total = ((HOUR_END - HOUR_START) * 60) / SLOT_MINUTES;
    for (let i = 0; i < total; i++) {
      arr.push(new Date(base.getTime() + i * SLOT_MINUTES * 60_000));
    }
    return arr;
  }, [date]);

  const memberMap = useMemo(() => {
    const m = new Map<string, OrgMember>();
    members.forEach((mem) => m.set(mem.user_id, mem));
    return m;
  }, [members]);

  const dayStart = new Date(date);
  dayStart.setHours(HOUR_START, 0, 0, 0);

  function getApptStyle(appt: Appointment): React.CSSProperties {
    const start = new Date(appt.start_at);
    const end = new Date(appt.end_at);
    const offsetMin = (start.getTime() - dayStart.getTime()) / 60_000;
    const durMin = (end.getTime() - start.getTime()) / 60_000;
    const top = (offsetMin / SLOT_MINUTES) * ROW_HEIGHT;
    const height = Math.max(28, (durMin / SLOT_MINUTES) * ROW_HEIGHT - 2);
    const member = memberMap.get(appt.doctor_id);
    const color = member?.display_color ?? "hsl(var(--primary))";
    return {
      top: `${top}px`,
      height: `${height}px`,
      borderLeftColor: color,
      backgroundColor: `${color}14`,
    };
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[80px_1fr] relative">
        {/* Time column */}
        <div className="border-r border-border bg-muted/30">
          {slots.map((slot, i) => (
            <div
              key={i}
              className="border-b border-border/40 text-[11px] text-muted-foreground px-2 flex items-start pt-0.5"
              style={{ height: ROW_HEIGHT }}
            >
              {slot.getMinutes() === 0 ? formatTime(slot) : ""}
            </div>
          ))}
        </div>

        {/* Slots */}
        <div className="relative">
          {slots.map((slot, i) => (
            <button
              key={i}
              onClick={() => onSlotClick(slot)}
              className={cn(
                "block w-full border-b text-left transition-colors hover:bg-primary/5",
                slot.getMinutes() === 0 ? "border-border/60" : "border-border/20"
              )}
              style={{ height: ROW_HEIGHT }}
            />
          ))}

          {/* Appointments overlay */}
          {appointments.map((appt) => {
            const member = memberMap.get(appt.doctor_id);
            return (
              <button
                key={appt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onAppointmentClick(appt);
                }}
                className="absolute left-2 right-2 rounded-md border-l-4 px-3 py-1.5 text-left shadow-sm hover:shadow-md transition-all hover:translate-x-0.5 overflow-hidden"
                style={getApptStyle(appt)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {appt.patient_name_snapshot}
                  </span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", STATUS_BADGE_CLASS[appt.status])}>
                    {STATUS_LABEL[appt.status]}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {formatTime(appt.start_at)} - {formatTime(appt.end_at)}
                  {member?.display_name && ` • ${member.display_name}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
