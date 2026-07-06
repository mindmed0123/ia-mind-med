import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_pacientes",
  title: "Listar pacientes",
  description: "Lista os pacientes do médico autenticado (mais recentes primeiro).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (padrão 20)."),
    search: z.string().optional().describe("Filtro por nome do paciente (opcional)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    let q = client(ctx).from("patients").select("*").order("created_at", { ascending: false }).limit(limit ?? 20);
    if (search) q = q.ilike("full_name", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
