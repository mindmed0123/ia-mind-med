import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dav-chat`;

export function useDavChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }

    setConversations(data || []);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    const typedMessages: ChatMessage[] = (data || []).map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      created_at: m.created_at,
    }));
    setMessages(typedMessages);
    setCurrentConversationId(conversationId);
  }, []);

  const createConversation = useCallback(async (title: string = 'Nova conversa') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: user.id, title })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a conversa",
        variant: "destructive",
      });
      return null;
    }

    setConversations(prev => [data, ...prev]);
    setCurrentConversationId(data.id);
    setMessages([]);
    return data;
  }, [toast]);

  const updateConversationTitle = useCallback(async (conversationId: string, title: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (!error) {
      setConversations(prev => 
        prev.map(c => c.id === conversationId ? { ...c, title } : c)
      );
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conversa",
        variant: "destructive",
      });
      return;
    }

    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [currentConversationId, toast]);

  const saveMessage = useCallback(async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single();

    if (error) {
      console.error('Error saving message:', error);
      return null;
    }

    return data;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    let conversationId = currentConversationId;
    
    // Create conversation if needed
    if (!conversationId) {
      const newConversation = await createConversation();
      if (!newConversation) return;
      conversationId = newConversation.id;
    }

    // Add user message to UI
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Save user message
    await saveMessage(conversationId, 'user', content.trim());

    // Prepare messages for API
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setIsLoading(true);
    setIsStreaming(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    let assistantContent = '';
    const assistantMessageId = crypto.randomUUID();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          messages: apiMessages,
          conversationId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar mensagem');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      // Add empty assistant message
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      }]);

      setIsLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => 
                prev.map(m => 
                  m.id === assistantMessageId 
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch {
            // Incomplete JSON, put back in buffer
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await saveMessage(conversationId, 'assistant', assistantContent);

        // Update conversation title if it's the first message
        if (messages.length === 0) {
          const title = content.trim().slice(0, 50) + (content.length > 50 ? '...' : '');
          await updateConversationTitle(conversationId, title);
        }

        // Update conversation updated_at
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted');
        return;
      }

      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: (error as Error).message || "Não foi possível enviar a mensagem",
        variant: "destructive",
      });

      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [currentConversationId, createConversation, messages, saveMessage, updateConversationTitle, isStreaming, toast]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  return {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    isStreaming,
    loadConversations,
    loadMessages,
    createConversation,
    deleteConversation,
    sendMessage,
    stopStreaming,
    startNewConversation,
  };
}
