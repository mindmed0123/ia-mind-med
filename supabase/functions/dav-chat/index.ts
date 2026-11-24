// MindChat: copiloto clínico de apoio. Contexto da consulta é lido no servidor
// (laudo do próprio médico), nunca enviado pelo cliente.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { searchPubMed, type PubMedArticle } from '../_shared/pubmed.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  laudoId: z.string().uuid().nullable().optional(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(6000) })).min(1).max(30),
});

const SYSTEM = `Você é o MindChat, copiloto clínico da MindMed, conversando com um(a) médico(a) habilitado(a).
Papel: APOIO ao raciocínio e à documentação. A decisão é sempre do médico.

Regras de segurança (obrigatórias):
- Nunca afirme diagnóstico definitivo. Use "possibilidades a considerar", "compatível com", "vale avaliar".
- Não prescreva por conta própria. Doses só quando o médico perguntar, sempre como referência de bula/diretriz a ser conferida.
- Se faltar dado essencial, faça UMA pergunta curta antes de responder.
- Nunca invente estudos ou PMIDs. Cite apenas [PMID:XXXX] retornados pela ferramenta search_pubmed.

Estilo:
- PT-BR, direto, escaneável. Comece pela resposta em 1 frase em negrito.
- Depois, no máximo 3 a 5 tópicos curtos. Sem floreio.
- Use a ferramenta search_pubmed quando a pergunta envolver conduta, tratamento, eficácia, diretriz ou acurácia de exame.
- Textos para o paciente: linguagem simples, acolhedora, sem jargão, sem CID.
- Termine respostas clínicas com a linha: "_Referência clínica — a avaliação do médico prevalece._"`;

const TOOL = {
  type: 'function',
  function: {
    name: 'search_pubmed',
    description: 'Busca artigos no PubMed em tempo real para fundamentar a resposta.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Termos em inglês para PubMed.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

const txt = (v: unknown, max = 600): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v.slice(0, max);
  try { return JSON.stringify(v).slice(0, max); } catch { return ''; }
};

function buildContext(l: Record<string, unknown> | null): string {
  if (!l) return '';
  const p = (l.patient_data ?? {}) as Record<string, unknown>;
  const transcript = typeof l.transcript === 'string' ? l.transcript
    : txt((l.transcript as Record<string, unknown> | null)?.text ?? l.transcript, 6000);
  const parts = [
    '[CONTEXTO DA CONSULTA — use para personalizar; não repita tudo]',
    p.age || p.idade ? `Idade: ${txt(p.age ?? p.idade, 20)}` : '',
    p.sex || p.sexo ? `Sexo: ${txt(p.sex ?? p.sexo, 20)}` : '',
    p.allergies || p.alergias ? `Alergias: ${txt(p.allergies ?? p.alergias, 200)}` : '',
    l.specialty ? `Especialidade: ${txt(l.specialty, 60)}` : '',
    l.diagnosis_main ? `Hipótese registrada: ${txt(l.diagnosis_main, 300)}` : '',
    l.diagnosis_diff ? `Diferenciais registrados: ${txt(l.diagnosis_diff, 400)}` : '',
    l.cid10_codes ? `CID-10: ${txt(l.cid10_codes, 200)}` : '',
    l.conducts ? `Conduta registrada: ${txt(l.conducts, 800)}` : '',
    l.complementary_exams ? `Exames: ${txt(l.complementary_exams, 500)}` : '',
    transcript ? `Transcrição (trecho):\n${transcript.slice(0, 6000)}` : '',
    '[FIM DO CONTEXTO]',
  ];
  return parts.filter(Boolean).join('\n');
}

const enc = new TextEncoder();
const sse = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: authErr } = await userClient.auth.getClaims(auth.slice(7));
  const userId = claims?.claims?.sub as string | undefined;
  if (authErr || !userId) return json({ error: 'Unauthorized' }, 401);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'invalid_body', details: parsed.error.flatten().fieldErrors }, 400);
    body = parsed.data;
  } catch { return json({ error: 'invalid_json' }, 400); }

  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // Plano Free: 10 mensagens por mês, contadas no servidor; planos pagos são ilimitados.
  const { data: quota, error: quotaErr } = await service.rpc('consume_free_chat', { p_user_id: userId });
  if (quotaErr) return json({ error: 'Não foi possível verificar seu plano.' }, 500);
  if (!(quota as { allowed?: boolean })?.allowed) {
    return json({ error: 'Você usou as 10 mensagens do MindChat do plano Free neste mês. Assine o Pro para continuar sem limites.', code: 'FREE_LIMIT_CHAT' }, 402);
  }

  let laudo: Record<string, unknown> | null = null;
  if (body.laudoId) {
    const { data } = await service.from('laudos')
      .select('user_id, specialty, patient_data, diagnosis_main, diagnosis_diff, cid10_codes, conducts, complementary_exams, transcript')
      .eq('id', body.laudoId).maybeSingle();
    if (!data || data.user_id !== userId) return json({ error: 'Forbidden' }, 403);
    laudo = data;
  }

  const KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!KEY) return json({ error: 'ai_not_configured' }, 500);
  const ctx = buildContext(laudo);
  const msgs: Record<string, unknown>[] = [
    { role: 'system', content: SYSTEM + (ctx ? `\n\n${ctx}` : '') },
    ...body.messages,
  ];
  const call = (m: unknown[], stream: boolean, tools: boolean) =>
    fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3.8-flash', messages: m, stream, temperature: 0.2, ...(tools ? { tools: [TOOL], tool_choice: 'auto' } : {}) }),
    });
  const gatewayError = (s: number) => s === 429 ? 'Muitas perguntas seguidas. Tente em instantes.'
    : s === 402 ? 'Créditos de IA esgotados no momento.' : 'O MindChat está indisponível agora. Tente novamente.';

  const stream = new ReadableStream({
    async start(c) {
      try {
        // Rodada 1 (sem streaming): decide se busca evidências.
        const r1 = await call(msgs, false, true);
        if (!r1.ok) { c.enqueue(sse('error', { message: gatewayError(r1.status) })); c.close(); return; }
        const d1 = await r1.json();
        const m1 = d1.choices?.[0]?.message ?? {};
        const toolCalls = (m1.tool_calls ?? []) as Array<{ id: string; function: { name: string; arguments: string } }>;
        const citations: PubMedArticle[] = [];
        if (toolCalls.length) {
          const toolMsgs: unknown[] = [];
          for (const tc of toolCalls.slice(0, 2)) {
            let q = '';
            try { q = String(JSON.parse(tc.function.arguments || '{}').query ?? '').slice(0, 200); } catch { /* */ }
            c.enqueue(sse('searching', { query: q }));
            let arts: PubMedArticle[] = [];
            try { if (q) arts = await searchPubMed(q, 4); } catch (e) { console.error('pubmed', e); }
            for (const a of arts) if (!citations.some((x) => x.pmid === a.pmid)) citations.push(a);
            toolMsgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(arts.map((a) => ({ pmid: a.pmid, title: a.title, journal: a.journal, year: a.year, abstract: (a as { abstract?: string }).abstract?.slice(0, 700) }))) });
          }
          c.enqueue(sse('citations', { citations: citations.map(({ pmid, title, authors, journal, year, url }) => ({ pmid, title, authors, journal, year, url })) }));
          const r2 = await call([...msgs, { role: 'assistant', content: m1.content ?? '', tool_calls: toolCalls.slice(0, 2) }, ...toolMsgs], true, false);
          if (!r2.ok || !r2.body) { c.enqueue(sse('error', { message: gatewayError(r2.status) })); c.close(); return; }
          const reader = r2.body.getReader(); const dec = new TextDecoder(); let buf = '';
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            buf += dec.decode(value, { stream: true });
            let i: number;
            while ((i = buf.indexOf('\n')) !== -1) {
              const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
              if (!line.startsWith('data: ')) continue;
              const s = line.slice(6).trim(); if (s === '[DONE]') continue;
              try { const t = JSON.parse(s).choices?.[0]?.delta?.content; if (t) c.enqueue(sse('delta', { t })); } catch { /* parcial */ }
            }
          }
        } else if (m1.content) {
          c.enqueue(sse('delta', { t: m1.content }));
        }
        c.enqueue(sse('done', {}));
      } catch (e) {
        console.error('dav-chat', e);
        c.enqueue(sse('error', { message: 'O MindChat está indisponível agora. Tente novamente.' }));
      }
      c.close();
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
});
