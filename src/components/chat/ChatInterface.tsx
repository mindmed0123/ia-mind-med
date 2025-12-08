import { useEffect, useRef } from 'react';
import { Bot, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ChatMessage as ChatMessageType } from '@/hooks/useDavChat';

interface ChatInterfaceProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  isStreaming: boolean;
  onSendMessage: (message: string) => void;
  onStopStreaming: () => void;
  onToggleSidebar?: () => void;
}

export function ChatInterface({
  messages,
  isLoading,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onToggleSidebar,
}: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-cyan-500/10 to-blue-600/10">
        {onToggleSidebar && (
          <Button
            onClick={onToggleSidebar}
            size="sm"
            variant="ghost"
            className="md:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-semibold">MindChat</h1>
          <p className="text-xs text-muted-foreground">Seu copiloto clínico</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Olá, doutor(a)! 👋
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Sou o MindChat, seu copiloto clínico. Estou aqui para ajudar com dúvidas médicas, 
                diagnósticos diferenciais, condutas e muito mais.
              </p>
              <div className="grid gap-2 text-sm text-left max-w-md">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="font-medium mb-1">💡 Exemplo de pergunta:</p>
                  <p className="text-muted-foreground">
                    "Paciente 45 anos, dor torácica há 2h, irradia para MSE, sudorese..."
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="font-medium mb-1">📋 O que posso fazer:</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Diagnósticos diferenciais</li>
                    <li>• Sugerir exames</li>
                    <li>• Condutas baseadas em evidências</li>
                    <li>• Identificar red flags</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                />
              ))}
            </div>
          )}
          
          {isLoading && !isStreaming && (
            <div className="p-4">
              <ChatMessage
                role="assistant"
                content=""
                isStreaming={true}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="max-w-3xl mx-auto w-full">
        <ChatInput
          onSend={onSendMessage}
          onStop={onStopStreaming}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
