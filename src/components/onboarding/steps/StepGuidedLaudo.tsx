import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, FileText, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StepGuidedLaudoProps {
  onLaudoCreated: (laudoId: string) => void;
  onSkip: () => void;
  onBack: () => void;
}

const EXAMPLE_TEXT = `Paciente Maria Silva, 45 anos, sexo feminino.
Queixa principal: cefaleia recorrente há 3 meses, com piora vespertina.
História: Nega trauma craniano, hipertensa em uso de Losartana 50mg.
Exame físico: PA 140x90, FC 78, sem sinais neurológicos focais.
Hipótese diagnóstica: Cefaleia tensional crônica.
Conduta: Orientação sobre hábitos, ajuste anti-hipertensivo, retorno em 30 dias.`;

export const StepGuidedLaudo = ({ onLaudoCreated, onSkip, onBack }: StepGuidedLaudoProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [usedExample, setUsedExample] = useState(false);

  const handleUseExample = () => {
    setText(EXAMPLE_TEXT);
    setUsedExample(true);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({ title: "Texto vazio", description: "Cole ou digite o texto da consulta", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      // Create laudo
      const { data: laudo, error: createError } = await supabase
        .from("laudos")
        .insert({
          user_id: user!.id,
          title: `[TESTE] Laudo de demonstração - ${new Date().toLocaleDateString("pt-BR")}`,
          status: "draft",
          generation_mode: "text",
          transcript: { text: text.trim() },
        })
        .select()
        .single();

      if (createError) throw createError;

      // Call generate-laudo edge function
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const { error: fnError } = await supabase.functions.invoke("generate-laudo", {
        body: {
          patient: {
            iniciais: "N/I",
            sexo: "Não informado",
            idade: 0,
          },
          specialty: "Não especificada",
          chief_complaint: "Não informada",
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

      toast({ title: "Laudo gerado com sucesso!", description: "Seu primeiro laudo foi criado pela IA" });
      onLaudoCreated(laudo.id);
    } catch (error: any) {
      toast({ title: "Erro ao gerar", description: error.message || "Tente novamente", variant: "destructive" });
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
            <h2 className="text-lg font-semibold">Gere seu primeiro laudo</h2>
            <p className="text-sm text-muted-foreground">
              Cole um resumo de consulta ou use nosso exemplo para testar a IA
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Texto da consulta</Label>
              {!usedExample && (
                <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={handleUseExample}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  Usar exemplo
                </Button>
              )}
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui o resumo da consulta, anamnese ou anotações clínicas..."
              className="min-h-[160px] text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A IA irá estruturar um laudo profissional a partir deste texto.
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
                Gerar Laudo com IA
              </>
            )}
          </Button>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <Button variant="ghost" onClick={onSkip} className="flex-1 text-sm">
              Pular por agora
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
