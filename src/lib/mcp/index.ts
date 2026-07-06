import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPacientes from "./tools/list-pacientes";
import listLaudos from "./tools/list-laudos";
import getLaudo from "./tools/get-laudo";
import searchMedications from "./tools/search-medications";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mindmed-mcp",
  title: "MindMed",
  version: "0.1.0",
  instructions:
    "Ferramentas do MindMed para assistentes de IA. Permite consultar pacientes, laudos e o catálogo de medicamentos do médico autenticado. Todas as operações são somente-leitura e respeitam a autorização (RLS) do usuário.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPacientes, listLaudos, getLaudo, searchMedications],
});
