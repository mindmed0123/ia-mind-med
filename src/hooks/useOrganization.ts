import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  timezone: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: "owner" | "doctor" | "staff";
  display_name: string | null;
  display_color: string | null;
  is_active: boolean;
}

export function useOrganization() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setLoading(false);
      return;
    }

    (async () => {
      // 1) Buscar membership do usuário
      const { data: memberRow } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!memberRow || !mounted) {
        setLoading(false);
        return;
      }

      const orgId = memberRow.organization_id;

      // 2) Buscar org + membros em paralelo
      const [{ data: org }, { data: ms }] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
        supabase
          .from("organization_members")
          .select("*")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
      ]);

      if (!mounted) return;
      if (org) setOrganization(org as Organization);
      if (ms) setMembers(ms as OrgMember[]);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  return { organization, members, loading };
}
