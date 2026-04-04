import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

interface Section {
  key: string;
  label: string;
  content: string;
  icon: string;
}

interface ProgressiveResultProps {
  sections: Section[];
  patientName?: string;
  specialty?: string;
  /** Delay between each section reveal in ms */
  revealDelay?: number;
}

export const ProgressiveResult = ({ sections, patientName, specialty, revealDelay = 400 }: ProgressiveResultProps) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (sections.length === 0) return;
    setVisibleCount(0);
    
    let count = 0;
    const reveal = () => {
      count++;
      setVisibleCount(count);
      if (count < sections.length) {
        timerRef.current = setTimeout(reveal, revealDelay);
      }
    };
    
    // Start first reveal quickly
    timerRef.current = setTimeout(reveal, 150);
    
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [sections.length, revealDelay]);

  return (
    <div className="space-y-4">
      {/* Header with patient info */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          {patientName && (
            <h3 className="text-lg font-semibold text-foreground">{patientName}</h3>
          )}
          {specialty && (
            <Badge variant="secondary" className="mt-1">{specialty}</Badge>
          )}
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          <CheckCircle className="w-3 h-3 mr-1" />
          Laudo gerado
        </Badge>
      </div>

      {/* Progressive sections */}
      {sections.map((section, i) => (
        <div
          key={section.key}
          className={`transition-all duration-500 ${
            i < visibleCount 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'
          }`}
        >
          <Card className="border border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <span>{section.icon}</span>
                {section.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {section.content}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Loading placeholder for upcoming sections */}
      {visibleCount < sections.length && (
        <div className="space-y-3">
          {Array.from({ length: Math.min(2, sections.length - visibleCount) }).map((_, i) => (
            <Card key={`skeleton-${i}`} className="border border-border/30 animate-pulse">
              <CardContent className="py-6">
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
