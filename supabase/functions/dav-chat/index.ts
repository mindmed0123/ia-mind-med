import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchPubMed, type PubMedArticle } from "../_shared/pubmed.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o **MindChat** — o copiloto clínico oficial da plataforma **MindMed**.
Sua função é tirar dúvidas médicas de forma rápida, segura e estruturada, **sempre embasada em evidências científicas atuais**.

## 🎯 MISSÃO
- Auxiliar clínico número 1 do médico.
- Raciocinar junto, oferecendo caminhos seguros e baseados em evidências.
- Citar literatura médica sempre que possível (PubMed, diretrizes).

## 🔬 USO DE EVIDÊNCIAS (RAG)
Você tem acesso à ferramenta \`search_pubmed\` que consulta a base científica PubMed/NCBI em tempo real.
**Use \`search_pubmed\` SEMPRE que a pergunta envolver:**
- Conduta clínica, dose, tratamento, eficácia
- Diagnóstico, sensibilidade, especificidade, prognóstico
- Diretrizes, guidelines, protocolos
- Comparações entre intervenções
- Doenças, síndromes, mecanismos fisiopatológicos
**Não use** para perguntas conversacionais, definições simples ou pedidos administrativos.

Após obter os artigos, integre os achados no raciocínio e cite-os no formato [PMID:XXXXXX] dentro do texto. Não invente PMIDs.

## 👨‍⚕️ TOM
Amigável, técnico, calmo. PT-BR formal. Zero julgamento.

## 🧬 FORMATO DA RESPOSTA
1. **Resumo do caso/pergunta**
2. **Hipóteses / Análise**
3. **Sinais de alerta**
4. **Exames recomendados**
5. **Condutas baseadas em evidências** (com citações [PMID:...])
6. **Quando encaminhar**
7. **Aviso:** "Recomendo confirmar com avaliação clínica presencial e protocolos da instituição."

## ⚠️ SEGURANÇA
- Não dar diagnóstico fechado.
- Não prescrever doses específicas.
- Reforçar avaliação presencial.

## 🧠 CONTEXTO
Você está dentro da MindMed. Eleve a segurança clínica do médico.`;

const PUBMED_TOOL = {
  type: "function",
  function: {
    name: "search_pubmed",
    description:
      "Busca artigos científicos na base PubMed/NCBI em tempo real. Use para fundamentar respostas clínicas com evidências atualizadas.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Termos de busca em INGLÊS, otimizados para PubMed. Ex: 'community acquired pneumonia treatment guidelines', 'troponin acute coronary syndrome sensitivity'.",
        },
        limit: {
          type: "number",
          description: "Quantidade de artigos (1-8). Padrão: 5.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

interface CitationOut {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  url: string;
}

function toCitation(a: PubMedArticle): CitationOut {
  return {
    pmid: a.pmid,
    title: a.title,
    authors: a.authors,
    journal: a.journal,
    year: a.year,
    url: a.url,
  };
}

function sseEvent(name: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

function passthroughSSE(line: string): Uint8Array {
  return new TextEncoder().encode(line + "\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, conversationId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("dav-chat: user", user.id, "conv", conversationId, "msgs", messages?.length);

    // Build initial chat thread
    const chatMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const collectedCitations: CitationOut[] = [];
    const seenPmids = new Set<string>();

    const stream = new ReadableStream({
      async start(controller) {
        const callGateway = async (msgs: any[], allowTools: boolean) => {
          return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: msgs,
              stream: true,
              ...(allowTools
                ? { tools: [PUBMED_TOOL], tool_choice: "auto" }
                : {}),
            }),
          });
        };

        // ROUND 1: allow tool calls (do not stream tokens to client yet — we
        // need to inspect whether the model decides to call tools).
        try {
          const r1 = await callGateway(chatMessages, true);
          if (!r1.ok) {
            const errText = await r1.text();
            console.error("AI gateway round1 error:", r1.status, errText);
            controller.enqueue(
              sseEvent("error", {
                status: r1.status,
                message:
                  r1.status === 429
                    ? "Limite de requisições. Tente em alguns minutos."
                    : r1.status === 402
                    ? "Créditos insuficientes."
                    : "Erro no serviço de IA.",
              })
            );
            controller.close();
            return;
          }

          const reader = r1.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let assistantText = "";
          const toolCallsByIndex = new Map<
            number,
            { id: string; name: string; argsBuf: string }
          >();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                  assistantText += delta.content;
                  // Stream tokens immediately
                  controller.enqueue(passthroughSSE(line));
                }

                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    const cur =
                      toolCallsByIndex.get(idx) ??
                      { id: "", name: "", argsBuf: "" };
                    if (tc.id) cur.id = tc.id;
                    if (tc.function?.name) cur.name = tc.function.name;
                    if (tc.function?.arguments)
                      cur.argsBuf += tc.function.arguments;
                    toolCallsByIndex.set(idx, cur);
                  }
                }
              } catch {
                // partial JSON — push back
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }

          // If no tool calls were requested, emit citations event (empty) + DONE.
          if (toolCallsByIndex.size === 0) {
            controller.enqueue(sseEvent("citations", { citations: [] }));
            controller.enqueue(passthroughSSE("data: [DONE]"));
            controller.close();
            return;
          }

          // Execute tool calls (PubMed)
          const toolCalls = Array.from(toolCallsByIndex.values());
          const toolMessages: any[] = [];
          for (const tc of toolCalls) {
            if (tc.name !== "search_pubmed") continue;
            let args: { query?: string; limit?: number } = {};
            try {
              args = JSON.parse(tc.argsBuf || "{}");
            } catch (e) {
              console.warn("Failed to parse tool args:", e);
            }
            const q = (args.query || "").trim();
            const lim = Math.max(1, Math.min(8, args.limit ?? 5));

            // Notify client we are searching
            controller.enqueue(
              sseEvent("tool_start", { tool: "search_pubmed", query: q })
            );

            let articles: PubMedArticle[] = [];
            if (q) {
              try {
                articles = await searchPubMed(q, lim);
              } catch (e) {
                console.error("PubMed error:", e);
              }
            }

            for (const a of articles) {
              if (!seenPmids.has(a.pmid)) {
                seenPmids.add(a.pmid);
                collectedCitations.push(toCitation(a));
              }
            }

            toolMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: "search_pubmed",
              content: JSON.stringify({
                query: q,
                results: articles.map((a) => ({
                  pmid: a.pmid,
                  title: a.title,
                  authors: a.authors,
                  journal: a.journal,
                  year: a.year,
                  abstract: a.abstract,
                })),
              }),
            });
          }

          // ROUND 2: send tool results back, stream final answer to client.
          const round2Messages = [
            ...chatMessages,
            {
              role: "assistant",
              content: assistantText || null,
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.argsBuf || "{}" },
              })),
            },
            ...toolMessages,
          ];

          // Inform client a new answer phase begins (so it can clear "searching" UI)
          controller.enqueue(sseEvent("answer_start", {}));

          const r2 = await callGateway(round2Messages, false);
          if (!r2.ok) {
            const errText = await r2.text();
            console.error("AI gateway round2 error:", r2.status, errText);
            controller.enqueue(
              sseEvent("error", { status: r2.status, message: "Erro no serviço de IA." })
            );
            controller.close();
            return;
          }

          const reader2 = r2.body!.getReader();
          let buf2 = "";
          while (true) {
            const { done, value } = await reader2.read();
            if (done) break;
            buf2 += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buf2.indexOf("\n")) !== -1) {
              let line = buf2.slice(0, nl);
              buf2 = buf2.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") break;
              // Pass through token deltas verbatim
              controller.enqueue(passthroughSSE(line));
            }
          }

          // Final citations event + DONE
          controller.enqueue(
            sseEvent("citations", { citations: collectedCitations })
          );
          controller.enqueue(passthroughSSE("data: [DONE]"));
          controller.close();
        } catch (err) {
          console.error("dav-chat stream error:", err);
          controller.enqueue(
            sseEvent("error", { message: "Erro ao processar mensagem." })
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error(`[${errorId}]`, error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar sua mensagem.", error_id: errorId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
