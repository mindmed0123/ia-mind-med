import { Bot, User, Search, BookOpen, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { Citation } from '@/hooks/useDavChat';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  citations?: Citation[];
  searching?: { query: string } | null;
}

export function ChatMessage({ role, content, isStreaming, citations, searching }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={cn(
      "flex gap-3 p-4 rounded-lg",
      isUser ? "bg-muted/50" : "bg-background"
    )}>
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground mb-1">
          {isUser ? 'Você' : 'MindChat'}
        </div>

        {/* Searching PubMed indicator */}
        {!isUser && searching && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <Search className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-foreground">
              Consultando PubMed: <span className="font-medium text-primary">{searching.query || '...'}</span>
            </span>
          </div>
        )}

        <div className="prose prose-sm dark:prose-invert max-w-none">
          {content ? (
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1 text-foreground">{children}</h3>,
                p: ({ children }) => <p className="mb-2 text-foreground leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-foreground">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-2">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          ) : isStreaming ? (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : null}
        </div>

        {/* Citations */}
        {!isUser && citations && citations.length > 0 && (
          <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Fontes científicas ({citations.length})
              </span>
            </div>
            <ol className="space-y-2">
              {citations.map((c, idx) => (
                <li key={c.pmid} className="text-xs leading-relaxed">
                  <span className="font-semibold text-muted-foreground mr-1">[{idx + 1}]</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-primary inline-flex items-baseline gap-1 group"
                  >
                    <span className="font-medium">{c.title}</span>
                    <ExternalLink className="w-3 h-3 inline-block opacity-60 group-hover:opacity-100 flex-shrink-0" />
                  </a>
                  <div className="text-muted-foreground mt-0.5 ml-6">
                    {c.authors.slice(0, 3).join(', ')}
                    {c.authors.length > 3 ? ' et al.' : ''}
                    {c.journal ? ` · ${c.journal}` : ''}
                    {c.year ? ` · ${c.year}` : ''}
                    <span className="ml-1 font-mono">PMID:{c.pmid}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
