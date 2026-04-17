import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrgInvite {
  id: string;
  email: string;
  full_name: string | null;
  display_color: string | null;
  role: "owner" | "doctor" | "staff";
  status: "pending" | "accepted" | "cancelled" | "expired";
  token: string;
  expires_at: string;
  created_at: string;
}

export function useOrgInvites(organizationId: string | null) {
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("organization_invites")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    setInvites((data as OrgInvite[]) ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { invites, loading, reload };
}
