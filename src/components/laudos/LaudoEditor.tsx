import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AnonymizeDialog } from "@/components/laudos/AnonymizeDialog";
import { EditorTutorial } from "@/components/laudos/EditorTutorial";
import { 
  Save, 
  CheckCircle, 
  Download, 
  Upload, 
  AlertTriangle,
  Clock,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";

interface LaudoEditorProps {
  laudoId: string;
  initialData?: any;
  onStatusChange?: (status: string) => void;
}

interface LaudoSections {
  identificacao: {
    nome: string;
    idade: string;
    sexo: string;
  };
  queixa: string;
  hda: string;
  exame_fisico: string;
  hipoteses: {
    principal: string;
    diferencial: string;
  };
  conduta: string;
  cid10: string[];
}

export const LaudoEditor = ({ laudoId, initialData, onStatusChange }: LaudoEditorProps) => {
  const { toast } = useToast();
  const [sections, setSections] = useState<LaudoSections>({
    identificacao: { nome: '', idade: '', sexo: '' },
    queixa: '',
    hda: '',
    exame_fisico: '',
    hipoteses: { principal: '', diferencial: '' },
    conduta: '',
    cid10: []
  });
  
  const [status, setStatus] = useState<'draft' | 'completed'>('draft');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [cid10Input, setCid10Input] = useState('');
  
  const debouncedSections = useDebounce(sections, 5000);
  const hasLoadedInitialData = useRef(false);

  // Show tutorial on first visit
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('editor_tutorial_seen');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    if (initialData && !hasLoadedInitialData.current) {
      const loadedSections = initialData.sections || {};
      setSections({
        identificacao: loadedSections.identificacao || { nome: '', idade: '', sexo: '' },
        queixa: loadedSections.queixa || '',
        hda: loadedSections.hda || '',
        exame_fisico: loadedSections.exame_fisico || '',
        hipoteses: loadedSections.hipoteses || { principal: '', diferencial: '' },
        conduta: loadedSections.conduta || '',
        cid10: loadedSections.cid10 || []
      });
      setStatus(initialData.status || 'draft');
      hasLoadedInitialData.current = true;
    }
  }, [initialData]);

  // Autosave
  useEffect(() => {
    if (hasLoadedInitialData.current) {
      handleSave();
    }
  }, [debouncedSections]);

  // Calculate word count
  useEffect(() => {
    const text = Object.values(sections).join(' ');
    const count = text.split(/\s+/).filter(word => word.length > 0).length;
    setWordCount(count);
  }, [sections]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('laudos')
        .update({
          sections: sections as any,
          diagnosis_main: sections.hipoteses.principal,
          diagnosis_diff: sections.hipoteses.diferencial
        })
        .eq('id', laudoId);

      if (error) throw error;
      
      setLastSaved(new Date());
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    // Validações
    if (!sections.hipoteses.principal || !sections.conduta) {
      toast({
        title: "Laudo incompleto",
        description: "Por favor, preencha a Hipótese Principal e a Conduta antes de finalizar.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('laudos')
        .update({ 
          status: 'completed',
          sections: sections as any,
          diagnosis_main: sections.hipoteses.principal,
          diagnosis_diff: sections.hipoteses.diferencial
        })
        .eq('id', laudoId);

      if (error) throw error;

      setStatus('completed');
      onStatusChange?.('completed');
      
      toast({
        title: "Laudo finalizado!",
        description: "O laudo foi marcado como concluído.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExportPdf = async () => {
    try {
      toast({
        title: "Gerando PDF...",
        description: "Aguarde enquanto o documento é gerado.",
      });

      const { data, error } = await supabase.functions.invoke('export-pdf', {
        body: { laudo_id: laudoId }
      });

      if (error) throw error;

      if (data?.html && data?.verifyToken) {
        // Importar dinamicamente as funções de PDF
        const { generatePdf, downloadPdf, uploadPdfToStorage } = await import('@/lib/pdf-generator');
        
        const baseUrl = window.location.origin;
        const verifyUrl = `${baseUrl}/api/verify-pdf/${laudoId}?token=${data.verifyToken}`;
        
        // Gerar PDF no cliente
        const pdfBlob = await generatePdf({
          html: data.html,
          fileName: data.fileName,
          verifyUrl
        });

        // Upload para storage
        const filePath = `reports/${laudoId}/exports/${Date.now()}.pdf`;
        const signedUrl = await uploadPdfToStorage(pdfBlob, filePath, supabase);

        // Atualizar laudo com URL do PDF
        await supabase
          .from('laudos')
          .update({ pdf_url: signedUrl })
          .eq('id', laudoId);

        // Download automático
        downloadPdf(pdfBlob, data.fileName);

        toast({
          title: "PDF gerado!",
          description: "O documento foi gerado e está pronto para uso.",
        });
      }
    } catch (error: any) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleImportPdf = async (file: File) => {
    try {
      // Upload do arquivo
      const filePath = `imports/${laudoId}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(filePath);

      // Importar PDF
      const { data, error } = await supabase.functions.invoke('import-pdf', {
        body: { 
          laudo_id: laudoId,
          pdf_url: urlData.publicUrl,
          ocr_enabled: true
        }
      });

      if (error) throw error;

      // Atualizar sections com dados importados
      if (data.sections) {
        setSections(data.sections);
        toast({
          title: "PDF importado!",
          description: "As seções foram preenchidas. Revise o conteúdo.",
        });
      }
    } catch (error: any) {
      console.error('Erro ao importar PDF:', error);
      toast({
        title: "Erro ao importar",
        description: error.message || "Não foi possível extrair o texto do PDF.",
        variant: "destructive"
      });
    }
  };

  const addCid10 = () => {
    if (cid10Input.trim()) {
      setSections(prev => ({
        ...prev,
        cid10: [...prev.cid10, cid10Input.trim().toUpperCase()]
      }));
      setCid10Input('');
    }
  };

  const removeCid10 = (index: number) => {
    setSections(prev => ({
      ...prev,
      cid10: prev.cid10.filter((_, i) => i !== index)
    }));
  };

  const isComplete = sections.hipoteses.principal && sections.conduta;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <div className="space-y-6">
      {/* Tutorial */}
      <EditorTutorial
        show={showTutorial}
        onComplete={() => {
          setShowTutorial(false);
          localStorage.setItem('editor_tutorial_seen', 'true');
        }}
      />
      
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Editor de Laudo
                <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
                  {status === 'completed' ? 'Concluído' : 'Rascunho'}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {wordCount} palavras • ~{readingTime} min de leitura
                </span>
                {lastSaved && (
                  <span className="text-xs">
                    {isSaving ? 'Salvando...' : `Salvo ${lastSaved.toLocaleTimeString()}`}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".pdf"
                id="pdf-upload"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImportPdf(e.target.files[0])}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('pdf-upload')?.click()}
                disabled={status === 'completed'}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar PDF
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Validação */}
      {!isComplete && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Campos obrigatórios faltando
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-200 mt-1 list-disc list-inside">
                  {!sections.hipoteses.principal && <li>Hipótese Principal</li>}
                  {!sections.conduta && <li>Conduta/Plano</li>}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção 1: Identificação do Paciente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Identificação do Paciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="nome">Nome/Iniciais</Label>
              <Input
                id="nome"
                value={sections.identificacao.nome}
                onChange={(e) => setSections(prev => ({
                  ...prev,
                  identificacao: { ...prev.identificacao, nome: e.target.value }
                }))}
                placeholder="N/I"
                disabled={status === 'completed'}
              />
            </div>
            <div>
              <Label htmlFor="idade">Idade</Label>
              <Input
                id="idade"
                value={sections.identificacao.idade}
                onChange={(e) => setSections(prev => ({
                  ...prev,
                  identificacao: { ...prev.identificacao, idade: e.target.value }
                }))}
                placeholder="45 anos"
                disabled={status === 'completed'}
              />
            </div>
            <div>
              <Label htmlFor="sexo">Sexo</Label>
              <Input
                id="sexo"
                value={sections.identificacao.sexo}
                onChange={(e) => setSections(prev => ({
                  ...prev,
                  identificacao: { ...prev.identificacao, sexo: e.target.value }
                }))}
                placeholder="Masculino/Feminino"
                disabled={status === 'completed'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 2: Queixa Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Queixa Principal</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={sections.queixa}
            onChange={(e) => setSections(prev => ({ ...prev, queixa: e.target.value }))}
            placeholder="Descreva a queixa principal do paciente..."
            rows={3}
            disabled={status === 'completed'}
          />
        </CardContent>
      </Card>

      {/* Seção 3: HDA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. História da Doença Atual (HDA)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={sections.hda}
            onChange={(e) => setSections(prev => ({ ...prev, hda: e.target.value }))}
            placeholder="Descreva a evolução dos sintomas, duração, características..."
            rows={6}
            disabled={status === 'completed'}
          />
        </CardContent>
      </Card>

      {/* Seção 4: Exame Físico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Exame Físico / Achados Relevantes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={sections.exame_fisico}
            onChange={(e) => setSections(prev => ({ ...prev, exame_fisico: e.target.value }))}
            placeholder="Descreva os achados do exame físico..."
            rows={5}
            disabled={status === 'completed'}
          />
        </CardContent>
      </Card>

      {/* Seção 5: Hipóteses Diagnósticas */}
      <Card className={!sections.hipoteses.principal ? 'border-red-200' : ''}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            5. Hipóteses Diagnósticas
            {!sections.hipoteses.principal && (
              <Badge variant="destructive">Obrigatório</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="hipotese-principal" className="font-semibold">
              A) Principal (Mais Provável) *
            </Label>
            <Textarea
              id="hipotese-principal"
              value={sections.hipoteses.principal}
              onChange={(e) => setSections(prev => ({
                ...prev,
                hipoteses: { ...prev.hipoteses, principal: e.target.value }
              }))}
              placeholder="Descreva a hipótese diagnóstica mais provável..."
              rows={4}
              disabled={status === 'completed'}
              className={!sections.hipoteses.principal ? 'border-red-300' : ''}
            />
          </div>
          
          <Separator />
          
          <div>
            <Label htmlFor="hipotese-diferencial" className="font-semibold">
              B) Diferencial (Menos Provável)
            </Label>
            <Textarea
              id="hipotese-diferencial"
              value={sections.hipoteses.diferencial}
              onChange={(e) => setSections(prev => ({
                ...prev,
                hipoteses: { ...prev.hipoteses, diferencial: e.target.value }
              }))}
              placeholder="Descreva hipóteses diagnósticas alternativas..."
              rows={4}
              disabled={status === 'completed'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção 6: Conduta */}
      <Card className={!sections.conduta ? 'border-red-200' : ''}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            6. Conduta / Plano Terapêutico
            {!sections.conduta && (
              <Badge variant="destructive">Obrigatório</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={sections.conduta}
            onChange={(e) => setSections(prev => ({ ...prev, conduta: e.target.value }))}
            placeholder="Descreva o plano de tratamento, medicações, orientações..."
            rows={6}
            disabled={status === 'completed'}
            className={!sections.conduta ? 'border-red-300' : ''}
          />
        </CardContent>
      </Card>

      {/* Seção 7: CID-10 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">7. CID-10 (Opcional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={cid10Input}
              onChange={(e) => setCid10Input(e.target.value)}
              placeholder="Ex: K29.1"
              onKeyPress={(e) => e.key === 'Enter' && addCid10()}
              disabled={status === 'completed'}
            />
            <Button
              onClick={addCid10}
              disabled={status === 'completed'}
            >
              Adicionar
            </Button>
          </div>
          
          {sections.cid10.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sections.cid10.map((cid, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => status !== 'completed' && removeCid10(index)}
                >
                  {cid} {status !== 'completed' && '×'}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {sections.identificacao?.nome && (
          <AnonymizeDialog
            laudoId={laudoId}
            patientName={sections.identificacao.nome}
            onAnonymized={() => {
              // Recarregar dados
              window.location.reload();
            }}
          />
        )}
        
        <Button
          variant="outline"
          size="lg"
          onClick={handleExportPdf}
          disabled={!isComplete}
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
        
        {status === 'draft' && (
          <Button
            size="lg"
            onClick={handleFinalize}
            disabled={!isComplete}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Marcar como Concluído
          </Button>
        )}
      </div>
    </div>
  );
};