import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, Mail, RefreshCw } from "lucide-react";

export type SmartStage = 
  | 'uploading' 
  | 'transcribing' 
  | 'organizing' 
  | 'diagnosing' 
  | 'structuring' 
  | 'completed' 
  | 'error';

interface StageConfig {
  label: string;
  sublabel: string;
  targetPercent: number;
  icon: string;
}

const STAGES: Record<SmartStage, StageConfig> = {
  uploading:    { label: "Captando áudio...",                    sublabel: "Enviando dados com segurança",                targetPercent: 15,  icon: "📤" },
  transcribing: { label: "Transcrevendo consulta...",            sublabel: "Convertendo fala em texto com IA",            targetPercent: 40,  icon: "🎙️" },
  organizing:   { label: "Organizando informações clínicas...", sublabel: "Identificando sintomas, medicamentos e histórico", targetPercent: 60, icon: "🧬" },
  diagnosing:   { label: "Gerando hipóteses diagnósticas...",   sublabel: "Relacionando achados clínicos com evidências", targetPercent: 80,  icon: "🧠" },
  structuring:  { label: "Estruturando laudo final...",         sublabel: "Formatando documento clínico completo",        targetPercent: 95,  icon: "📋" },
  completed:    { label: "Laudo pronto!",                       sublabel: "Tudo certo",                                   targetPercent: 100, icon: "✅" },
  error:        { label: "Erro no processamento",               sublabel: "Algo deu errado",                              targetPercent: 0,   icon: "❌" },
};

const SMART_MESSAGES = [
  "Analisando sintomas reportados...",
  "Verificando interações medicamentosas...",
  "Relacionando histórico clínico...",
  "Validando consistência médica...",
  "Consultando base de evidências...",
  "Organizando dados do exame físico...",
  "Cruzando informações do prontuário...",
  "Priorizando diagnósticos diferenciais...",
];

interface SmartProgressProps {
  stage: SmartStage;
  onRetry?: () => void;
  onEmailFallback?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export const SmartProgress = ({ stage, onRetry, onEmailFallback, isRetrying, className }: SmartProgressProps) => {
  const [displayPercent, setDisplayPercent] = useState(0);
  const [smartMessage, setSmartMessage] = useState(SMART_MESSAGES[0]);
  const [showSlowWarning, setShowSlowWarning] = useState(false);
  const [showEmailOption, setShowEmailOption] = useState(false);
  const stageStartTime = useRef(Date.now());
  const animFrameRef = useRef<number>();
  const messageIndexRef = useRef(0);

  // Non-linear progress animation
  useEffect(() => {
    if (stage === 'error') {
      setDisplayPercent(0);
      return;
    }
    if (stage === 'completed') {
      setDisplayPercent(100);
      return;
    }

    const target = STAGES[stage].targetPercent;
    const start = displayPercent;
    const startTime = Date.now();
    const duration = 800; // ms for initial burst

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic for fast start, slow end
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (target - start) * eased;
      setDisplayPercent(Math.round(current));

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [stage]);

  // Slow creep between stages (never stuck)
  useEffect(() => {
    if (stage === 'completed' || stage === 'error') return;
    const target = STAGES[stage].targetPercent;
    
    const creep = setInterval(() => {
      setDisplayPercent(prev => {
        if (prev >= target - 1) return prev;
        return prev + 0.5;
      });
    }, 2000);

    return () => clearInterval(creep);
  }, [stage]);

  // Rotating smart messages
  useEffect(() => {
    if (stage === 'completed' || stage === 'error' || stage === 'uploading') return;
    
    const interval = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % SMART_MESSAGES.length;
      setSmartMessage(SMART_MESSAGES[messageIndexRef.current]);
    }, 3000);

    return () => clearInterval(interval);
  }, [stage]);

  // Slow warning after 5s, email option after 10s
  useEffect(() => {
    stageStartTime.current = Date.now();
    setShowSlowWarning(false);
    setShowEmailOption(false);

    const slowTimer = setTimeout(() => setShowSlowWarning(true), 15000);
    const emailTimer = setTimeout(() => setShowEmailOption(true), 30000);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(emailTimer);
    };
  }, [stage]);

  if (stage === 'completed') return null;

  const stageKeys: SmartStage[] = ['uploading', 'transcribing', 'organizing', 'diagnosing', 'structuring'];
  const currentIdx = stageKeys.indexOf(stage);
  const config = STAGES[stage];

  return (
    <Card className={`border-2 border-primary/20 bg-card overflow-hidden ${className || ''}`}>
      {/* Top gradient bar */}
      <div className="h-1 gradient-primary" />
      
      <CardContent className="pt-6 pb-5 space-y-5">
        {/* Stage indicator dots */}
        {stage !== 'error' && (
          <div className="flex items-center justify-center gap-2">
            {stageKeys.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`
                  w-2.5 h-2.5 rounded-full transition-all duration-500
                  ${i < currentIdx ? 'bg-primary scale-100' : ''}
                  ${i === currentIdx ? 'bg-primary scale-125 animate-pulse' : ''}
                  ${i > currentIdx ? 'bg-muted' : ''}
                `} />
                {i < stageKeys.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 transition-all duration-500 ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="text-center space-y-2">
          <div className="text-3xl">{config.icon}</div>
          <h3 className="text-lg font-semibold text-foreground">{config.label}</h3>
          <p className="text-sm text-muted-foreground">{config.sublabel}</p>
        </div>

        {/* Progress bar */}
        {stage !== 'error' && (
          <div className="space-y-2">
            <Progress value={displayPercent} className="h-2" />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground animate-fade-in" key={smartMessage}>
                {smartMessage}
              </p>
              <span className="text-xs font-medium text-primary">{Math.round(displayPercent)}%</span>
            </div>
          </div>
        )}

        {/* Slow warning */}
        {showSlowWarning && stage !== 'error' && (
          <div className="text-center animate-fade-in">
            <p className="text-sm text-muted-foreground">
              ⚡ Estamos finalizando seu laudo com alta precisão...
            </p>
          </div>
        )}

        {/* Email fallback */}
        {showEmailOption && stage !== 'error' && onEmailFallback && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center animate-fade-in">
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Continuar aguardando
            </Button>
            <Button variant="secondary" size="sm" onClick={onEmailFallback}>
              <Mail className="w-3 h-3 mr-1" />
              Receber por e-mail
            </Button>
          </div>
        )}

        {/* Error state */}
        {stage === 'error' && (
          <div className="text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">
              Não conseguimos processar sua consulta. Tente novamente ou acione o suporte.
            </p>
            {onRetry && (
              <Button onClick={onRetry} disabled={isRetrying} className="mx-auto">
                {isRetrying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Reprocessar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
