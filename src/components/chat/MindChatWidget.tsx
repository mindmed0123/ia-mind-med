import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Square, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface MindChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ConsultationContext {
  patientName?: string;
  patientAge?: string;
  patientSex?: string;
  chiefComplaint?: string;
  transcript?: string;
  diagnosisMain?: string;
  diagnosisDiff?: string;
  hypotheses?: string[];
  redFlags?: string[];
  cid10?: string[];
  medications?: string[];
  allergies?: string[];
  comorbidities?: string[];
}

interface MindChatWidgetProps {
  context?: ConsultationContext;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dav-chat`;

function buildContextPrompt(ctx?: ConsultationContext): string {
  if (!ctx) return '';
  const parts: string[] = ['[CONTEXTO DA CONSULTA ATUAL]'];
  if (ctx.patientName) parts.push(`Paciente: ${ctx.patientName}`);
  if (ctx.patientAge) parts.push(`Idade: ${ctx.patientAge}`);
  if (ctx.patientSex) parts.push(`Sexo: ${ctx.patientSex}`);
  if (ctx.chiefComplaint) parts.push(`Queixa principal: ${ctx.chiefComplaint}`);
  if (ctx.medications?.length) parts.push(`Medicações: ${ctx.medications.join(', ')}`);
  if (ctx.allergies?.length) parts.push(`Alergias: ${ctx.allergies.join(', ')}`);
  if (ctx.comorbidities?.length) parts.push(`Comorbidades: ${ctx.comorbidities.join(', ')}`);
  if (ctx.diagnosisMain) parts.push(`Hipótese principal: ${ctx.diagnosisMain}`);
  if (ctx.diagnosisDiff) parts.push(`Diagnóstico diferencial: ${ctx.diagnosisDiff}`);
  if (ctx.hypotheses?.length) parts.push(`Hipóteses: ${ctx.hypotheses.join(', ')}`);
  if (ctx.redFlags?.length) parts.push(`Red flags: ${ctx.redFlags.join(', ')}`);
  if (ctx.cid10?.length) parts.push(`CID-10: ${ctx.cid10.join(', ')}`);
  if (ctx.transcript) parts.push(`\nTranscrição da consulta:\n${ctx.transcript.slice(0, 2000)}`);
  parts.push('[FIM DO CONTEXTO]\n');
  return parts.join('\n');
}

export function MindChatWidget({ context }: MindChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MindChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: MindChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    abortRef.current = new AbortController();
    const assistantId = crypto.randomUUID();
    let assistantContent = '';

    // Build API messages with context injected in first user message
    const contextPrefix = messages.length === 0 ? buildContextPrompt(context) : '';
    const apiMessages = [...messages, userMsg].map((m, i) => ({
      role: m.role,
      content: i === 0 && m.role === 'user' && contextPrefix
        ? contextPrefix + m.content
        : m.content,
    }));
    // If this is the very first message, prepend context
    if (messages.length === 0 && contextPrefix) {
      apiMessages[0].content = contextPrefix + text;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao processar');
      }

      if (!response.body) throw new Error('No body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);
      setIsLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setMessages(prev => prev.filter(m => m.id !== assistantId));
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '❌ Não foi possível processar. Tente novamente.',
      }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, context, isStreaming]);

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center group"
          title="MindChat - Copiloto Clínico"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background animate-pulse bg-emerald-500" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">MindChat</h3>
                <p className="text-[10px] text-muted-foreground">Copiloto clínico com IA</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {context?.patientName && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {context.patientName}
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Copiloto clínico ativo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pergunte sobre a consulta atual. O MindChat tem acesso ao contexto do paciente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Diagnóstico diferencial?', 'Exames indicados?', 'Red flags?', 'Conduta segura?'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border hover:bg-accent transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ol]:mb-1.5 [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs">
                      <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre a consulta..."
                className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl"
                rows={1}
              />
              {isStreaming ? (
                <Button size="icon" variant="destructive" className="h-10 w-10 shrink-0 rounded-xl" onClick={stopStreaming}>
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={sendMessage} disabled={!input.trim() || isLoading}>
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
