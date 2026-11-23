// Server-side plan entitlement. Edge functions that spend AI credits must call
// this after authenticating the caller; client-side plan checks are UX only.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Entitlement = {
  status: string | null;
  plan: string | null;
  /** ACTIVE or TRIALING subscription (any plan). */
  active: boolean;
  /** Active subscription on PRO or CLINIC. */
  pro: boolean;
};

export async function getEntitlement(serviceClient: SupabaseClient, userId: string): Promise<Entitlement> {
  const { data } = await serviceClient
    .from("subscriptions")
    .select("status, plan")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const status = (data?.status as string | undefined) ?? null;
  const plan = (data?.plan as string | undefined) ?? null;
  const active = status === "ACTIVE" || status === "TRIALING";
  return { status, plan, active, pro: active && (plan === "PRO" || plan === "CLINIC") };
}
