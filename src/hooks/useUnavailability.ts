import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Unavailability {
  id: string;
  organization_id: string;
  doctor_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  title: string | null;
  recurrence_pattern: "none" | "weekly";
  recurrence_end_date: string | null;
  recurrence_weekdays: number[] | null;
  created_by: string;
  created_at: string;
}

export function useUnavailability(organizationId: string | null, reloadKey: number = 0) {
  const [items, setItems] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("doctor_unavailability")
      .select("*")
      .eq("organization_id", organizationId)
      .order("start_at", { ascending: false });
    setItems((data as Unavailability[]) ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  return { items, loading, reload: load };
}
