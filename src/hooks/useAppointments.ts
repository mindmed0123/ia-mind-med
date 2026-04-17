import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  organization_id: string;
  doctor_id: string;
  patient_id: string | null;
  patient_name_snapshot: string;
  patient_phone_snapshot: string | null;
  patient_email_snapshot: string | null;
  appointment_type_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  source: "internal" | "online";
  notes: string | null;
  internal_notes: string | null;
  laudo_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentType {
  id: string;
  organization_id: string;
  name: string;
  duration_minutes: number;
  color: string;
  is_active: boolean;
}

interface UseAppointmentsArgs {
  organizationId: string | null;
  rangeStart: Date;
  rangeEnd: Date;
  doctorIds?: string[];
}

export function useAppointments({ organizationId, rangeStart, rangeEnd, doctorIds }: UseAppointmentsArgs) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("appointments")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("start_at", rangeStart.toISOString())
      .lte("start_at", rangeEnd.toISOString())
      .order("start_at", { ascending: true });

    if (doctorIds && doctorIds.length > 0) {
      q = q.in("doctor_id", doctorIds);
    }

    const { data, error: err } = await q;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setAppointments((data as Appointment[]) ?? []);
    setLoading(false);
  }, [organizationId, rangeStart.getTime(), rangeEnd.getTime(), doctorIds?.join(",")]);

  useEffect(() => {
    load();
  }, [load]);

  return { appointments, loading, error, reload: load };
}

export function useAppointmentTypes(organizationId: string | null) {
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!organizationId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("appointment_types")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("display_order");
      if (mounted && data) setTypes(data as AppointmentType[]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [organizationId]);

  return { types, loading };
}
