-- Tabela de conversas do DAV Chat
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de mensagens
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes para performance
CREATE INDEX idx_chat_conversations_user ON public.chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_updated ON public.chat_conversations(updated_at DESC);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para chat_conversations
CREATE POLICY "Users can view own conversations" 
ON public.chat_conversations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" 
ON public.chat_conversations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" 
ON public.chat_conversations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" 
ON public.chat_conversations FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations" 
ON public.chat_conversations FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para chat_messages (baseado na conversa pai)
CREATE POLICY "Users can view messages of own conversations" 
ON public.chat_messages FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.chat_conversations 
  WHERE id = conversation_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create messages in own conversations" 
ON public.chat_messages FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.chat_conversations 
  WHERE id = conversation_id AND user_id = auth.uid()
));

CREATE POLICY "Users can delete messages in own conversations" 
ON public.chat_messages FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.chat_conversations 
  WHERE id = conversation_id AND user_id = auth.uid()
));

CREATE POLICY "Admins can view all messages" 
ON public.chat_messages FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();