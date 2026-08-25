import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, FileText, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/useAnalytics";
import { trackLead } from "@/lib/metaPixel";

interface StepGuidedLaudoProps {
  onLaudoCreated: (laudoId: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
  skipLabel?: string;
}

const EXAMPLE_TEXT = `Paciente masculino, 54 anos, comparece para retorno de acompanhamento de hipertensão arterial sistêmica. Refere boa adesão ao losartana 50mg uma vez ao dia. Nega cefaleia, tontura ou dor precordial. Relata caminhadas três vezes por semana e redução do sal na dieta. Ao exame: pressão arterial 132 por 84, frequência cardíaca 72, ausculta cardíaca com ritmo regular em dois tempos, bulhas normofonéticas, sem sopros. Ausculta pulmonar limpa. Sem edema de membros inferiores. Mantida a medicação em uso. Solicitados eletrólitos, creatinina e perfil lipídico. Retorno em três meses com os exames.`;

export const StepGuidedLaudo = ({
  onLaudoCreated,
  onSkip,
  onBack,
  skipLabel = "Agora não",
}: StepGuidedLaudoProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackEvent } = useAnalytics();
  const [text, setText] = useState(EXAMPLE_TEXT);
  const [generating, setGenerating] = useState(false);

  const handleUseExample = () => setText(EXAMPLE_TEXT);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "Texto vazio",
        description: "Use o caso de exemplo ou cole o resumo de uma consulta sua",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    const isExample = text.trim() === EXAMPLE_TEXT.trim();
    trackEvent("demo_laudo_started", { usedExample: isExample });

    try {
      const { data: laudo, error: createError } = await supabase
        .from("laudos")
        .insert({
          user_id: user!.id,
          title: `Laudo de demonstração - ${new Date().toLocaleDateString("pt-BR")}`,
          status: "draft",
          generation_mode: "text",
          transcript: { text: text.trim() },
        })
        .select()
        .single();

      if (createError) throw createError;

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const { error: fnError } = await supabase.functions.invoke("generate-laudo", {
        body: {
          patient: { iniciais: "N/I", sexo: "Masculino", idade: 54 },
          specialty: "Clínica Geral",
          chief_complaint: "Retorno de acompanhamento",
          transcript: text.trim(),
          vitals: {},
          meds: [],
          allergies: [],
          exam_findings: "",
          contexto_clinico: "",
          historico: "",
          laudo_id: laudo.id,
          mode: "complete",
        },
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (fnError) throw fnError;

      await trackEvent("demo_laudo_completed", { laudoId: laudo.id, usedExample: isExample });
      if (user?.id) trackLead(user.id);

      toast({
        title: "Laudo gerado",
        description: "A IA estruturou o laudo a partir do texto da consulta.",
      });

      onLaudoCreated(laudo.id);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar laudo",
        description: error?.message || "Tente novamente em instantes",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="shadow-large">
      <CardContent className="pt-6 pb-6">
        <div className="space-y-5">
          <div className="text-center mb-2">
            <FileText className="w-10 h-10 text-primary mx-auto mb-2" />
            <h2 className="text-lg font-semibold">Gere um laudo de demonstração</h2>
            <p className="text-sm text-muted-foreground">
              Sem áudio e sem cadastrar paciente. Leva cerca de 40 segundos.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="demo_text">Ou cole o resumo de uma consulta sua</Label>
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0"
                onClick={handleUseExample}
                type="button"
              >
                Restaurar caso de exemplo
              </Button>
            </div>
            <Textarea
              id="demo_text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui o resumo da consulta, anamnese ou anotações clínicas..."
              className="min-h-[180px] text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A IA estrutura um laudo profissional a partir deste texto.
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full"
            size="lg"
            disabled={generating || !text.trim()}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando laudo com IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar laudo com IA
              </>
            )}
          </Button>

          {(onBack || onSkip) && (
            <div className="flex gap-3">
              {onBack && (
                <Button variant="outline" onClick={onBack} className="flex-1" disabled={generating}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
              )}
              {onSkip && (
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="flex-1 text-sm"
                  disabled={generating}
                >
                  {skipLabel}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
