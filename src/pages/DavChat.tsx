import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ProFeatureGate } from '@/components/pro/ProFeatureGate';
import { useDavChat } from '@/hooks/useDavChat';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

export default function DavChat() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    isStreaming,
    loadConversations,
    loadMessages,
    deleteConversation,
    sendMessage,
    stopStreaming,
    startNewConversation,
  } = useDavChat();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  if (authLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check if user has PRO plan
  if (!subscription?.isPro) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center gap-2 p-2 border-b">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar ao Dashboard</span>
          </Button>
        </div>
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <ProFeatureGate feature="o MindChat - Copiloto Clínico com IA">
            <div />
          </ProFeatureGate>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar with back button */}
      <div className="flex items-center gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Voltar ao Dashboard</span>
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Desktop */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <ChatSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={loadMessages}
            onNewConversation={startNewConversation}
            onDeleteConversation={deleteConversation}
          />
        </div>

        {/* Sidebar - Mobile (overlay) */}
        <div
          className={cn(
            "fixed inset-0 z-50 md:hidden transition-opacity",
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className={cn(
              "absolute left-0 top-0 h-full w-64 transition-transform",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <ChatSidebar
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={loadMessages}
              onNewConversation={startNewConversation}
              onDeleteConversation={deleteConversation}
              onClose={() => setSidebarOpen(false)}
              isMobile
            />
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            isStreaming={isStreaming}
            onSendMessage={sendMessage}
            onStopStreaming={stopStreaming}
            onToggleSidebar={() => setSidebarOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}
