import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgendaMetrics {
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  scheduled: number;
  confirmed: number;
  in_progress: number;
  total_minutes: number;
  available_minutes: number;
  occupancy_rate: number;
  no_show_rate: number;
  completion_rate: number;
  by_doctor: Array<{
    doctor_id: string;
    doctor_name: string;
    color: string;
    total: number;
    completed: number;
    no_show: number;
    cancelled: number;
  }>;
  by_type: Array<{
    type_name: string;
    color: string;
    total: number;
    no_show: number;
    completed: number;
  }>;
  by_status: Record<string, number>;
  by_day: Array<{ day: string; total: number; completed: number; no_show: number }>;
}

interface Args {
  organizationId: string | null;
  start: Date;
  end: Date;
  doctorId?: string | null;
}

export function useAgendaMetrics({ organizationId, start, end, doctorId }: Args) {
  const [metrics, setMetrics] = useState<AgendaMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.rpc("get_agenda_metrics" as any, {
      p_organization_id: organizationId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_doctor_id: doctorId ?? null,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setMetrics(data as unknown as AgendaMetrics);
    setLoading(false);
  }, [organizationId, start.getTime(), end.getTime(), doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  return { metrics, loading, error, reload: load };
}
