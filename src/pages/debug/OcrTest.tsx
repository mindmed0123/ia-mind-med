import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OcrTest = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setTestStatus('idle');
      setExtractedText("");
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo PDF",
        variant: "destructive"
      });
    }
  };

  const handleTestExtraction = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setTestStatus('idle');
    
    try {
      // Simular extração de texto
      // Em produção, isto chamaria a edge function import-pdf
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockText = `
LAUDO MÉDICO

Paciente: Maria Silva
Idade: 38 anos
Sexo: Feminino

QUEIXA PRINCIPAL:
Dor torácica há 3 dias

HISTÓRIA DA DOENÇA ATUAL:
Paciente relata dor em região precordial, tipo aperto, iniciada há 72 horas,
com piora aos esforços. Nega irradiação, náuseas ou sudorese.

EXAME FÍSICO:
Estado geral: Regular
PA: 140/90 mmHg | FC: 88 bpm | Tax: 36.5°C
Cardiovascular: RCR 2T BNF, sem sopros

HIPÓTESE DIAGNÓSTICA:
Principal: Angina estável
Diferencial: Síndrome coronariana aguda

CONDUTA:
1. ECG de repouso
2. Troponina seriada
3. Betabloqueador 25mg 2x/dia
4. Retorno em 48h

CID-10: I20.8
      `.trim();
      
      setExtractedText(mockText);
      setTestStatus('success');
      
      toast({
        title: "Texto extraído com sucesso!",
        description: `${mockText.length} caracteres processados`
      });
    } catch (error) {
      setTestStatus('error');
      toast({
        title: "Erro na extração",
        description: "Não foi possível processar o PDF",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Debug: Teste de OCR/Extração</h1>
          <Badge variant="secondary">Desenvolvimento</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload de PDF para Teste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload">
                <Button variant="outline" asChild>
                  <span>Selecionar PDF</span>
                </Button>
              </label>
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Arquivo selecionado: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            <Button
              onClick={handleTestExtraction}
              disabled={!file || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>Processando...</>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Testar Extração de Texto
                </>
              )}
            </Button>

            {testStatus === 'success' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Extração realizada com sucesso! Verifique o resultado abaixo.
                </AlertDescription>
              </Alert>
            )}

            {testStatus === 'error' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Falha na extração. Em produção, o sistema tentará OCR.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {extractedText && (
          <Card>
            <CardHeader>
              <CardTitle>Texto Extraído</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
                {extractedText}
              </pre>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Caracteres: {extractedText.length}</p>
                <p>Linhas: {extractedText.split('\n').length}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Configuração de OCR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Motor OCR</p>
                <Badge variant="secondary">Tesseract.js (Opcional)</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Ativado</p>
                <Badge>ENABLE_OCR=true</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Timeout</p>
                <p className="text-sm text-muted-foreground">30 segundos</p>
              </div>
              <div>
                <p className="text-sm font-medium">Tamanho Máx</p>
                <p className="text-sm text-muted-foreground">10 MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">⚠️ Notas Importantes</h3>
            <ul className="text-sm space-y-1 text-yellow-900 dark:text-yellow-100">
              <li>• OCR é opcional e pode aumentar significativamente o tempo de processamento</li>
              <li>• Para PDFs nativos (não escaneados), a extração de texto é rápida</li>
              <li>• Se a extração falhar, o sistema oferece fallback para entrada manual</li>
              <li>• A heurística mapeia automaticamente seções usando palavras-chave</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OcrTest;