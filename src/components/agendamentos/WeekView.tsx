import { useMemo } from "react";
import { Appointment } from "@/hooks/useAppointments";
import { OrgMember } from "@/hooks/useOrganization";
import { STATUS_BADGE_CLASS, STATUS_LABEL, formatTime } from "@/lib/appointment-utils";
import { cn } from "@/lib/utils";

interface Props {
  weekStart: Date;
  appointments: Appointment[];
  members: OrgMember[];
  onSlotClick: (start: Date) => void;
  onAppointmentClick: (appt: Appointment) => void;
}

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_MINUTES = 60;
const ROW_HEIGHT = 60;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function WeekView({ weekStart, appointments, members, onSlotClick, onAppointmentClick }: Props) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [weekStart]);

  const slots = useMemo(() => {
    const arr: number[] = [];
    for (let h = HOUR_START; h < HOUR_END; h++) arr.push(h);
    return arr;
  }, []);

  const memberMap = useMemo(() => {
    const m = new Map<string, OrgMember>();
    members.forEach((mem) => m.set(mem.user_id, mem));
    return m;
  }, [members]);

  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const key = new Date(a.start_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [appointments]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function getApptStyle(appt: Appointment, dayBase: Date): React.CSSProperties {
    const start = new Date(appt.start_at);
    const end = new Date(appt.end_at);
    const dayStart = new Date(dayBase);
    dayStart.setHours(HOUR_START, 0, 0, 0);
    const offsetMin = (start.getTime() - dayStart.getTime()) / 60_000;
    const durMin = (end.getTime() - start.getTime()) / 60_000;
    const top = (offsetMin / SLOT_MINUTES) * ROW_HEIGHT;
    const height = Math.max(24, (durMin / SLOT_MINUTES) * ROW_HEIGHT - 2);
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
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/20">
          <div className="px-2 py-3" />
          {days.map((d) => {
            const isToday = d.getTime() === today.getTime();
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  "px-2 py-3 text-center border-l border-border",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  {WEEKDAYS[d.getDay()]}
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold mt-0.5",
                    isToday ? "text-primary" : "text-foreground"
                  )}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
          {/* Time column */}
          <div className="border-r border-border bg-muted/10">
            {slots.map((h) => (
              <div
                key={h}
                className="border-b border-border/40 text-[11px] text-muted-foreground px-2 flex items-start pt-1"
                style={{ height: ROW_HEIGHT }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const dayKey = d.toDateString();
            const dayAppts = apptsByDay.get(dayKey) ?? [];
            return (
              <div key={d.toISOString()} className="relative border-l border-border">
                {slots.map((h) => {
                  const slotDate = new Date(d);
                  slotDate.setHours(h, 0, 0, 0);
                  return (
                    <button
                      key={h}
                      onClick={() => onSlotClick(slotDate)}
                      className="block w-full border-b border-border/30 hover:bg-primary/5 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                    />
                  );
                })}

                {dayAppts.map((appt) => (
                  <button
                    key={appt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(appt);
                    }}
                    className="absolute left-1 right-1 rounded border-l-4 px-2 py-1 text-left shadow-sm hover:shadow-md transition-all overflow-hidden"
                    style={getApptStyle(appt, d)}
                  >
                    <div className="text-[10px] font-semibold text-foreground truncate">
                      {appt.patient_name_snapshot}
                    </div>
                    <div className="text-[9px] text-muted-foreground truncate">
                      {formatTime(appt.start_at)}
                    </div>
                    <span className={cn("inline-block mt-0.5 text-[8px] px-1 rounded", STATUS_BADGE_CLASS[appt.status])}>
                      {STATUS_LABEL[appt.status]}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
