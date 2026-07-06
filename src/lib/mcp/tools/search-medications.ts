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
  name: "search_medications",
  title: "Buscar medicamentos",
  description: "Busca medicamentos no catálogo (opcionalmente priorizando por CID-10).",
  inputSchema: {
    query: z.string().min(1).describe("Termo de busca: nome comercial, princípio ativo ou classe."),
    cid: z.string().optional().describe("Código CID-10 do paciente para priorizar recomendações."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, cid }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const { data, error } = await client(ctx).rpc("search_medications", { q: query, cid: cid ?? null });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { medications: data ?? [] },
    };
  },
});
