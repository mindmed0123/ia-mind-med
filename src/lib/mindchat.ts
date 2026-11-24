import { supabase } from '@/integrations/supabase/client';

export interface MindChatCitation { pmid: string; title: string; authors: string[]; journal: string; year: string; url: string }
export interface MindChatTurn { role: 'user' | 'assistant'; content: string }

export interface MindChatHandlers {
  onDelta: (t: string) => void;
  onSearching: (q: string) => void;
  onCitations: (c: MindChatCitation[]) => void;
}

/** Lê os eventos SSE do MindChat. Lança Error com mensagem amigável. */
export async function askMindChat(laudoId: string | null, messages: MindChatTurn[], h: MindChatHandlers, signal?: AbortSignal) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dav-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ laudoId, messages: messages.slice(-20) }),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error && res.status !== 400 ? err.error : 'Não foi possível falar com o MindChat agora.');
  }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(block)?.[1]; const raw = /^data: (.+)$/m.exec(block)?.[1];
      if (!ev || !raw) continue;
      const d = JSON.parse(raw);
      if (ev === 'delta') h.onDelta(d.t);
      else if (ev === 'searching') h.onSearching(d.query);
      else if (ev === 'citations') h.onCitations(d.citations);
      else if (ev === 'error') throw new Error(d.message);
    }
  }
}
