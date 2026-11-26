// Creates the single onboarding demo report (is_demo = true) with the service role.
// One per account, forever; demo reports never consume the free allowance.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { bearerToken } from "../_shared/request-auth.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = bearerToken(req);
  if (!token) return json({ error: "not_authenticated" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "not_authenticated" }, 401);

  let body: { transcript?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript || transcript.length > 20000) return json({ error: "transcript must be 1-20000 chars" }, 400);

  const { data: existing } = await admin.from("laudos").select("id").eq("user_id", user.id).eq("is_demo", true).limit(1);
  if (existing && existing.length) return json({ error: "DEMO_JA_CRIADO", message: "O laudo de demonstração já foi criado nesta conta." }, 409);

  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const { data, error } = await admin.from("laudos").insert({
    user_id: user.id,
    title: `Laudo de demonstração - ${date}`,
    status: "draft",
    generation_mode: "text",
    transcript: { text: transcript },
    is_demo: true,
  }).select("id").single();

  if (error) {
    // Unique index laudos_um_demo_por_conta catches concurrent calls.
    if (error.code === "23505") return json({ error: "DEMO_JA_CRIADO", message: "O laudo de demonstração já foi criado nesta conta." }, 409);
    console.error("criar-laudo-demo insert failed", error.message);
    return json({ error: "insert_failed" }, 500);
  }
  return json({ id: data.id });
});
