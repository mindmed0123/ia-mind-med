import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "super_admin" | "admin" | "finance" | "support" | "sales";

interface AdminRoleState {
  loading: boolean;
  roles: AdminRole[];
  isAnyAdmin: boolean;
  isSuperAdmin: boolean;
  canManageBilling: boolean; // super_admin, admin, finance
  canManageUsers: boolean;   // super_admin, admin, support
  canManageSales: boolean;   // super_admin, admin, sales
  canDeactivate: boolean;    // super_admin only
}

const ADMIN_ROLES: AdminRole[] = ["super_admin", "admin", "finance", "support", "sales"];

export function useAdminRole(): AdminRoleState {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setRoles([]); setLoading(false); }
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!cancelled) {
        if (error) setRoles([]);
        else setRoles((data ?? []).map(r => r.role as AdminRole).filter(r => ADMIN_ROLES.includes(r)));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const has = (r: AdminRole) => roles.includes(r);
  const isSuperAdmin = has("super_admin");
  const isAnyAdmin = roles.length > 0;

  return {
    loading,
    roles,
    isAnyAdmin,
    isSuperAdmin,
    canManageBilling: isSuperAdmin || has("admin") || has("finance"),
    canManageUsers:   isSuperAdmin || has("admin") || has("support"),
    canManageSales:   isSuperAdmin || has("admin") || has("sales"),
    canDeactivate:    isSuperAdmin,
  };
}
