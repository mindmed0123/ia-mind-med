import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, X, Send, Square, Copy, BookOpen, Search, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { askMindChat, type MindChatCitation } from '@/lib/mindchat';
import { copyWithRecord } from '@/lib/activity-log';
import { toast } from 'sonner';

interface Msg { id: string; role: 'user' | 'assistant'; content: string; citations?: MindChatCitation[]; searching?: string | null }

const QUICK = [
  { label: 'Explicar ao paciente', prompt: 'Escreva uma explicação simples e acolhedora desta consulta para eu enviar ao paciente (diagnóstico em investigação, próximos passos e sinais para procurar atendimento).' },
  { label: 'Diferenciais a considerar', prompt: 'Quais diagnósticos diferenciais vale considerar neste caso e que dado da história ou exame ajudaria a separá-los?' },
  { label: 'Checar interações', prompt: 'Há interações ou contraindicações relevantes entre os medicamentos e condições desta consulta?' },
  { label: 'O que a evidência diz', prompt: 'Qual a evidência científica mais recente sobre a conduta deste caso? Cite os estudos.' },
  { label: 'Resumo para encaminhamento', prompt: 'Escreva um resumo clínico curto para carta de encaminhamento a um especialista.' },
];

export function MindChatWidget({ laudoId }: { laudoId: string | null }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [msgs]);
  useEffect(() => { setMsgs([]); }, [laudoId]);

  const send = async (text: string) => {
    const q = text.trim(); if (!q || busy) return;
    const history = [...msgs, { id: crypto.randomUUID(), role: 'user' as const, content: q }];
    const aid = crypto.randomUUID();
    setMsgs([...history, { id: aid, role: 'assistant', content: '' }]);
    setInput(''); setBusy(true);
    abort.current = new AbortController();
    const patch = (p: Partial<Msg> | ((m: Msg) => Partial<Msg>)) =>
      setMsgs((all) => all.map((m) => m.id === aid ? { ...m, ...(typeof p === 'function' ? p(m) : p) } : m));
    try {
      await askMindChat(laudoId, history.filter((m) => m.content).map(({ role, content }) => ({ role, content })), {
        onDelta: (t) => patch((m) => ({ content: m.content + t, searching: null })),
        onSearching: (s) => patch({ searching: s }),
        onCitations: (c) => patch({ citations: c }),
      }, abort.current.signal);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') patch({ content: `⚠️ ${(e as Error).message}`, searching: null });
    } finally { setBusy(false); abort.current = null; }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Abrir MindChat"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-xl transition hover:scale-[1.03] hover:shadow-2xl">
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-semibold">Pergunte ao MindChat</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:w-[420px]">
      <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15"><Sparkles className="h-4 w-4" /></div>
          <div>
            <p className="text-sm font-semibold leading-tight">MindChat</p>
            <p className="text-[11px] opacity-80">{laudoId ? 'Já conhece esta consulta' : 'Copiloto clínico'} · com PubMed</p>
          </div>
        </div>
        <div className="flex gap-1">
          {msgs.length > 0 && <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15" onClick={() => setMsgs([])} aria-label="Nova conversa"><RotateCcw className="h-4 w-4" /></Button>}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15" onClick={() => setOpen(false)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div ref={scroll} className="flex-1 space-y-3 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <div className="space-y-3 pt-2">
            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <p className="font-semibold">Olá, doutor(a)! 👋</p>
              <p className="mt-1 text-muted-foreground">
                {laudoId ? 'Eu já li esta consulta. Toque numa sugestão ou pergunte o que quiser.' : 'Pergunte sobre um caso, conduta ou evidência.'}
              </p>
            </div>
            <div className="grid gap-2">
              {QUICK.map((q) => (
                <button key={q.label} onClick={() => send(q.prompt)}
                  className="rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition hover:border-primary hover:bg-primary/5">
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[90%] rounded-2xl px-3 py-2 text-sm', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              {m.searching != null && (
                <p className="mb-1 flex items-center gap-1.5 text-xs text-primary"><Search className="h-3 w-3 animate-pulse" /> Buscando estudos no PubMed…</p>
              )}
              {m.role === 'assistant' && !m.content && m.searching == null && <span className="animate-pulse text-muted-foreground">Pensando…</span>}
              {m.role === 'assistant'
                ? <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                : m.content}
              {!!m.citations?.length && (
                <div className="mt-2 space-y-1 border-t pt-2">
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><BookOpen className="h-3 w-3" /> Referências</p>
                  {m.citations.map((c) => (
                    <a key={c.pmid} href={c.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-primary hover:underline">
                      {c.title} · {c.journal} {c.year}
                    </a>
                  ))}
                </div>
              )}
              {m.role === 'assistant' && m.content && !busy && (
                <button className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => copyWithRecord(m.content, { entity: 'REPORT', entityId: laudoId, label: 'mindchat' }).then(() => toast.success('Copiado'))}>
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form className="flex items-end gap-2 border-t p-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Pergunte ao MindChat…"
          className="max-h-32 min-h-[42px] resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} />
        {busy
          ? <Button type="button" size="icon" variant="outline" onClick={() => abort.current?.abort()} aria-label="Parar"><Square className="h-4 w-4" /></Button>
          : <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></Button>}
      </form>
      <p className="px-3 pb-2 text-center text-[10px] text-muted-foreground">Apoio à decisão. A avaliação do médico prevalece.</p>
    </div>
  );
}
