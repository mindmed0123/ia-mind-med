import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import type { Teleconsulta, TeleconsultaStatus } from "@/types/teleconsulta";

export function useTeleconsultas() {
  const { organization } = useOrganization();
  const [teleconsultas, setTeleconsultas] = useState<Teleconsulta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organization?.id) {
      setTeleconsultas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("teleconsultas" as any)
      .select("*")
      .eq("organization_id", organization.id)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) setTeleconsultas(data as unknown as Teleconsulta[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!organization?.id) return;
    const channel = supabase
      .channel(`teleconsultas:${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teleconsultas",
          filter: `organization_id=eq.${organization.id}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id, load]);

  const updateStatus = async (id: string, status: TeleconsultaStatus) => {
    const updates: Record<string, unknown> = { status };
    if (status === "sala_aberta") updates.room_opened_at = new Date().toISOString();
    if (status === "em_andamento") updates.started_at = new Date().toISOString();
    await supabase.from("teleconsultas" as any).update(updates).eq("id", id);
    await load();
  };

  const cancelar = async (id: string) => {
    await supabase.from("teleconsultas" as any).update({ status: "cancelada" }).eq("id", id);
    await load();
  };

  return { teleconsultas, loading, load, updateStatus, cancelar };
}
