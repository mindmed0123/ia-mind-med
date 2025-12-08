import { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isLoading, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!value.trim() || isLoading || isStreaming || disabled) return;
    onSend(value);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  return (
    <div className="flex items-end gap-2 p-4 border-t bg-background">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Descreva o caso clínico ou tire sua dúvida..."
        className="min-h-[44px] max-h-[200px] resize-none"
        rows={1}
        disabled={disabled}
      />
      
      {isStreaming ? (
        <Button
          onClick={onStop}
          size="icon"
          variant="destructive"
          className="flex-shrink-0"
        >
          <Square className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          onClick={handleSubmit}
          size="icon"
          disabled={!value.trim() || isLoading || disabled}
          className="flex-shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
        >
          <Send className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
