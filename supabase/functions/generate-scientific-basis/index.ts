import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchPubMed, type PubMedArticle } from "../_shared/pubmed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScientificBasis {
  summary: string;
  justification: string;
  search_queries: string[];
  articles: Array<{
    pmid: string;
    title: string;
    authors: string[];
    journal: string;
    year: string;
    url: string;
    relevance?: string;
  }>;
  guidelines: Array<{ name: string; source: string; url?: string }>;
  generated_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { laudo_id } = await req.json();
    if (!laudo_id) {
      return new Response(JSON.stringify({ error: "laudo_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Load laudo (must belong to user)
    const { data: laudo, error: lErr } = await adminClient
      .from("laudos")
      .select(
        "id, user_id, diagnosis_main, diagnosis_diff, hypotheses, cid10_codes, sections, summary, complementary_exams, conducts, specialty"
      )
      .eq("id", laudo_id)
      .single();
    if (lErr || !laudo) {
      return new Response(JSON.stringify({ error: "Laudo not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (laudo.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 1: ask the LLM for optimized PubMed search queries (in English)
    const hypothesisMain =
      laudo.diagnosis_main ||
      (laudo.hypotheses as any)?.mais_provavel?.descricao ||
      (laudo.sections as any)?.hipoteses?.principal ||
      "";
    const hypothesisDiff =
      laudo.diagnosis_diff ||
      (laudo.hypotheses as any)?.menos_provavel?.descricao ||
      "";
    const cids = Array.isArray(laudo.cid10_codes) ? laudo.cid10_codes.join(", ") : "";
    const summary =
      (laudo.summary as any)?.resumo_clinico || (laudo.sections as any)?.hda || "";

    const queryGenResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "You are a medical librarian. Given a clinical case, output 3 optimized PubMed search queries in ENGLISH (MeSH-style when possible) that retrieve the most relevant evidence (guidelines, RCTs, meta-analyses) for diagnosis and management. Return ONLY a JSON array of 3 strings.",
            },
            {
              role: "user",
              content: JSON.stringify({
                main_hypothesis: hypothesisMain,
                differential: hypothesisDiff,
                cid10: cids,
                clinical_summary: summary.slice(0, 800),
                specialty: laudo.specialty || "general",
              }),
            },
          ],
        }),
      }
    );

    let queries: string[] = [];
    if (queryGenResp.ok) {
      const qData = await queryGenResp.json();
      const raw = qData.choices?.[0]?.message?.content || "[]";
      try {
        const m = raw.match(/\[[\s\S]*\]/);
        queries = m ? JSON.parse(m[0]) : [];
      } catch {
        queries = [];
      }
    }
    if (queries.length === 0 && hypothesisMain) {
      queries = [`${hypothesisMain} guidelines treatment`];
    }
    queries = queries.slice(0, 3);

    // STEP 2: query PubMed in parallel
    const articlesByQuery = await Promise.all(
      queries.map((q) => searchPubMed(q, 4).catch(() => [] as PubMedArticle[]))
    );
    const allArticles: PubMedArticle[] = [];
    const seen = new Set<string>();
    for (const list of articlesByQuery) {
      for (const a of list) {
        if (!seen.has(a.pmid)) {
          seen.add(a.pmid);
          allArticles.push(a);
        }
      }
    }
    const topArticles = allArticles.slice(0, 8);

    // STEP 3: ask LLM to write justification grounded in those articles
    const groundResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Você é um médico-pesquisador. Com base no caso clínico e nos artigos PubMed fornecidos, gere um EMBASAMENTO CIENTÍFICO em PT-BR.
Responda em JSON estrito com este shape:
{
  "summary": "1 parágrafo resumindo o estado da arte para este caso",
  "justification": "2-3 parágrafos justificando hipótese e condutas, citando [PMID:XXXX]",
  "guidelines": [{"name":"...","source":"WHO/NIH/ESC/SBC/...","url":"..."}],
  "article_relevance": [{"pmid":"...","relevance":"frase curta explicando relevância"}]
}
Use APENAS PMIDs que aparecem nos artigos. Não invente.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                case: {
                  main_hypothesis: hypothesisMain,
                  differential: hypothesisDiff,
                  cid10: cids,
                  clinical_summary: summary.slice(0, 1200),
                  conducts: laudo.conducts,
                  exams: laudo.complementary_exams,
                },
                articles: topArticles.map((a) => ({
                  pmid: a.pmid,
                  title: a.title,
                  journal: a.journal,
                  year: a.year,
                  abstract: a.abstract.slice(0, 600),
                })),
              }),
            },
          ],
        }),
      }
    );

    let llmOut: any = {};
    if (groundResp.ok) {
      const gData = await groundResp.json();
      const raw = gData.choices?.[0]?.message?.content || "{}";
      try {
        const m = raw.match(/\{[\s\S]*\}/);
        llmOut = m ? JSON.parse(m[0]) : {};
      } catch {
        llmOut = {};
      }
    }

    const relevanceMap = new Map<string, string>();
    for (const r of llmOut.article_relevance ?? []) {
      if (r?.pmid) relevanceMap.set(String(r.pmid), r.relevance ?? "");
    }

    const scientificBasis: ScientificBasis = {
      summary: llmOut.summary || "",
      justification: llmOut.justification || "",
      search_queries: queries,
      articles: topArticles.map((a) => ({
        pmid: a.pmid,
        title: a.title,
        authors: a.authors,
        journal: a.journal,
        year: a.year,
        url: a.url,
        relevance: relevanceMap.get(a.pmid) || undefined,
      })),
      guidelines: Array.isArray(llmOut.guidelines) ? llmOut.guidelines : [],
      generated_at: new Date().toISOString(),
    };

    const { error: updErr } = await adminClient
      .from("laudos")
      .update({ scientific_basis: scientificBasis as any })
      .eq("id", laudo_id);
    if (updErr) {
      console.error("update scientific_basis error:", updErr);
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ scientific_basis: scientificBasis }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-scientific-basis error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
