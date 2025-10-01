import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

interface RealtimeTranscriptionProps {
  laudoId: string;
  onTranscriptUpdate?: (segments: TranscriptSegment[]) => void;
}

export const RealtimeTranscription = ({ laudoId, onTranscriptUpdate }: RealtimeTranscriptionProps) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  useEffect(() => {
    if (onTranscriptUpdate) {
      onTranscriptUpdate(segments);
    }
  }, [segments, onTranscriptUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transcrição</CardTitle>
          {isProcessing && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processando...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]" ref={scrollRef}>
          <div className="space-y-3">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aguardando transcrição...
              </p>
            ) : (
              segments.map((segment, index) => (
                <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTime(segment.start)}</span>
                    <span>→</span>
                    <span>{formatTime(segment.end)}</span>
                    <span className={`ml-auto ${getConfidenceColor(segment.confidence)}`}>
                      {Math.round(segment.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-sm">{segment.text}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
