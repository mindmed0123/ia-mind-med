import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2, FileText } from 'lucide-react';

interface TextInputModeProps {
  onGenerate: (text: string) => Promise<void>;
  isGenerating: boolean;
}

export function TextInputMode({ onGenerate, isGenerating }: TextInputModeProps) {
  const [consultationText, setConsultationText] = useState('');

  const handleGenerate = async () => {
    if (!consultationText.trim()) return;
    await onGenerate(consultationText);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Modo Texto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="consultation-text">Descrição da Consulta</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Descreva os dados da consulta: queixa principal, história clínica, exame físico, impressões diagnósticas, etc.
          </p>
          <Textarea
            id="consultation-text"
            value={consultationText}
            onChange={(e) => setConsultationText(e.target.value)}
            placeholder="Ex: Paciente do sexo masculino, 45 anos, comparece com queixa de cefaleia frontal há 3 dias, de intensidade moderada, que piora com luz forte. Nega náuseas ou vômitos. PA: 140x90mmHg. Exame neurológico sem alterações..."
            rows={12}
            className="resize-none"
            disabled={isGenerating}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {consultationText.length} caracteres
          </p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!consultationText.trim() || isGenerating}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Gerando Laudo...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5 mr-2" />
              Gerar Laudo com IA
            </>
          )}
        </Button>

        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <h4 className="font-medium mb-2">Dicas para um laudo completo:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Inclua dados demográficos (idade, sexo)</li>
            <li>Descreva a queixa principal e duração</li>
            <li>Mencione história médica relevante</li>
            <li>Inclua achados do exame físico</li>
            <li>Liste medicações em uso e alergias</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
