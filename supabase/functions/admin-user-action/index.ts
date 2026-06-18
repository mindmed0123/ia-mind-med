import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | { type: "extend_trial"; user_id: string; days: number }
  | { type: "grant_courtesy"; user_id: string; plan: "STARTER" | "PRO"; days: number }
  | { type: "change_plan"; user_id: string; plan: "STARTER" | "PRO" }
  | { type: "set_status"; user_id: string; status: string; reason?: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "no_auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);
    const actor = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Validate actor roles
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", actor);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isSuper = roleSet.has("super_admin");
    const canBilling = isSuper || roleSet.has("admin") || roleSet.has("finance");
    const canUsers = isSuper || roleSet.has("admin") || roleSet.has("support");

    const body = (await req.json()) as Action;
    if (!body?.type || !body.user_id) return json({ error: "invalid_body" }, 400);

    let result: any;
    switch (body.type) {
      case "extend_trial": {
        if (!canBilling) return json({ error: "forbidden" }, 403);
        const { data, error } = await admin.rpc("admin_extend_trial", {
          p_user_id: body.user_id, p_days: body.days, p_actor: actor,
        });
        if (error) throw error;
        result = data;
        break;
      }
      case "grant_courtesy": {
        if (!canBilling) return json({ error: "forbidden" }, 403);
        const { data, error } = await admin.rpc("admin_grant_courtesy", {
          p_user_id: body.user_id, p_plan: body.plan, p_days: body.days, p_actor: actor,
        });
        if (error) throw error;
        result = data;
        break;
      }
      case "change_plan": {
        if (!canBilling) return json({ error: "forbidden" }, 403);
        const { data, error } = await admin.rpc("admin_change_plan", {
          p_user_id: body.user_id, p_plan: body.plan, p_actor: actor,
        });
        if (error) throw error;
        result = data;
        break;
      }
      case "set_status": {
        // deactivation (INACTIVE/CANCELED) is super_admin only; others billing-admins
        const destructive = body.status === "INACTIVE" || body.status === "CANCELED";
        if (destructive ? !isSuper : !canBilling) return json({ error: "forbidden" }, 403);
        const { data, error } = await admin.rpc("admin_set_subscription_status", {
          p_user_id: body.user_id, p_status: body.status, p_reason: body.reason ?? null, p_actor: actor,
        });
        if (error) throw error;
        result = data;
        break;
      }
      default:
        return json({ error: "unknown_action" }, 400);
    }

    return json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
