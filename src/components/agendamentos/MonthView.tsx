import { useMemo } from "react";
import { Appointment } from "@/hooks/useAppointments";
import { OrgMember } from "@/hooks/useOrganization";
import { cn } from "@/lib/utils";

interface Props {
  monthStart: Date;
  appointments: Appointment[];
  members: OrgMember[];
  onDayClick: (day: Date) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthView({ monthStart, appointments, members, onDayClick }: Props) {
  const cells = useMemo(() => {
    const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const last = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const startWeekday = first.getDay();
    const totalDays = last.getDate();

    const arr: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startWeekday; i++) arr.push({ date: null });
    for (let d = 1; d <= totalDays; d++) {
      arr.push({ date: new Date(monthStart.getFullYear(), monthStart.getMonth(), d) });
    }
    while (arr.length % 7 !== 0) arr.push({ date: null });
    return arr;
  }, [monthStart]);

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

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/20">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-3 py-2.5 text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {cells.map((cell, idx) => {
          if (!cell.date) {
            return <div key={idx} className="min-h-[110px] border-b border-r border-border/40 bg-muted/10" />;
          }
          const isToday = cell.date.getTime() === today.getTime();
          const dayAppts = apptsByDay.get(cell.date.toDateString()) ?? [];
          const visibleCount = 3;
          return (
            <button
              key={idx}
              onClick={() => onDayClick(cell.date!)}
              className={cn(
                "min-h-[110px] border-b border-r border-border/40 p-1.5 text-left hover:bg-primary/5 transition-colors group",
                isToday && "bg-primary/5"
              )}
            >
              <div
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium mb-1",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground group-hover:bg-primary/10"
                )}
              >
                {cell.date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayAppts.slice(0, visibleCount).map((appt) => {
                  const member = memberMap.get(appt.doctor_id);
                  const color = member?.display_color ?? "hsl(217 91% 60%)";
                  return (
                    <div
                      key={appt.id}
                      className="text-[10px] truncate px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${color}1f`, color }}
                    >
                      {new Date(appt.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                      {appt.patient_name_snapshot}
                    </div>
                  );
                })}
                {dayAppts.length > visibleCount && (
                  <div className="text-[10px] text-muted-foreground px-1.5 font-medium">
                    +{dayAppts.length - visibleCount} mais
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
