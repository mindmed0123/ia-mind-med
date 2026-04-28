import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Image as ImageIcon, Loader2, RefreshCw, Trash2, Eye, Sparkles, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { validateFile } from "@/lib/validation";

interface ExamFile {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  ai_description?: string | null;
  ai_analysis?: any;
  analyzed_at?: string | null;
  analyzing?: boolean;
  medical_observation?: string;
  persisted?: boolean;
}

interface ExamUploadSectionProps {
  laudoId: string;
  patientId?: string | null;
  patientName?: string;
  clinicalContext?: string;
  transcriptText?: string;
  onExamsAnalyzed?: (summary: string) => void;
  onRegenerateWithExams?: (examSummary: string) => void;
}

export const ExamUploadSection = ({
  laudoId,
  patientId,
  patientName,
  clinicalContext,
  transcriptText,
  onExamsAnalyzed,
  onRegenerateWithExams,
}: ExamUploadSectionProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exams, setExams] = useState<ExamFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [updatingLaudo, setUpdatingLaudo] = useState(false);
  const [manualExamText, setManualExamText] = useState('');
  const [updatingFromManual, setUpdatingFromManual] = useState(false);

  const handleManualExamUpdate = async () => {
    const text = manualExamText.trim();
    if (text.length < 5) {
      toast({
        title: 'Descrição muito curta',
        description: 'Adicione uma descrição com mais detalhes do exame.',
        variant: 'destructive',
      });
      return;
    }
    setUpdatingFromManual(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-laudo', {
        body: {
          laudo_id: laudoId,
          additional_info: text,
          source: 'manual_exam',
        },
      });
      if (error) throw error;
      toast({
        title: 'Laudo atualizado!',
        description: data?.change_summary || 'A descrição foi incorporada ao laudo.',
      });
      setManualExamText('');
      onExamsAnalyzed?.(text);
    } catch (err: any) {
      toast({
        title: 'Não foi possível atualizar',
        description: 'Seu laudo original foi preservado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingFromManual(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const validation = validateFile(file, {
          maxSize: 10 * 1024 * 1024,
          allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        });

        if (!validation.valid) {
          toast({ title: "Arquivo inválido", description: validation.error, variant: "destructive" });
          continue;
        }

        const filePath = `exams/${laudoId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('patient-documents')
          .upload(filePath, file);

        if (uploadError) {
          toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('patient-documents')
          .getPublicUrl(filePath);

        // Save to patient_documents if patient exists
        let docId: string = crypto.randomUUID();
        let persisted = false;
        if (patientId) {
          const { data: doc, error: docError } = await supabase
            .from('patient_documents')
            .insert({
              id: docId,
              patient_id: patientId,
              user_id: user.id,
              file_name: file.name,
              file_type: file.type,
              file_url: urlData.publicUrl,
              file_size: file.size,
              category: 'exam',
            })
            .select()
            .single();

          if (!docError && doc) {
            docId = doc.id;
            persisted = true;
          }
        }

        const newExam: ExamFile = {
          id: docId,
          file_name: file.name,
          file_type: file.type,
          file_url: urlData.publicUrl,
          analyzing: false,
          medical_observation: '',
          persisted,
        };

        setExams(prev => [...prev, newExam]);

        // Auto-analyze (sem observação ainda — médico pode reprocessar depois com a obs)
        analyzeExam(newExam);
      }

      toast({ title: "Upload concluído", description: "Exames enviados com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const analyzeExam = async (exam: ExamFile, observationOverride?: string) => {
    const observation = observationOverride !== undefined ? observationOverride : exam.medical_observation;
    setExams(prev => prev.map(e => e.id === exam.id ? { ...e, analyzing: true } : e));

    try {
      const { data, error } = await supabase.functions.invoke('analyze-image', {
        body: {
          documentId: exam.id,
          imageUrl: exam.file_url,
          patientName: patientName || '',
          patientId: patientId || '',
          medicalObservation: observation || '',
          clinicalContext: clinicalContext || '',
          transcriptText: transcriptText || '',
        }
      });

      if (error) throw error;

      setExams(prev => prev.map(e =>
        e.id === exam.id
          ? {
              ...e,
              analyzing: false,
              ai_description: data.analysis?.description,
              ai_analysis: data.analysis,
              analyzed_at: new Date().toISOString(),
            }
          : e
      ));
    } catch (error: any) {
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, analyzing: false } : e));
      toast({ title: "Erro na análise", description: "Não foi possível analisar o exame", variant: "destructive" });
    }
  };

  const updateObservation = (id: string, value: string) => {
    setExams(prev => prev.map(e => e.id === id ? { ...e, medical_observation: value } : e));
  };

  const handleReprocess = async (exam: ExamFile) => {
    if (!exam.medical_observation?.trim()) {
      toast({
        title: "Observação vazia",
        description: "Adicione uma observação clínica para reprocessar com contexto.",
        variant: "destructive",
      });
      return;
    }

    // Persiste a observação no banco (se existe registro)
    if (exam.persisted) {
      await supabase
        .from('patient_documents')
        .update({ medical_observation: exam.medical_observation })
        .eq('id', exam.id);
    }

    toast({ title: "Reprocessando exame", description: "A IA está reanalisando com sua observação clínica." });
    await analyzeExam(exam, exam.medical_observation);
  };

  const removeExam = (id: string) => {
    setExams(prev => prev.filter(e => e.id !== id));
  };

  const buildExamSummary = (analyzedExams: ExamFile[]) =>
    analyzedExams.map(e => {
      const analysis = e.ai_analysis;
      const obs = e.medical_observation?.trim()
        ? `\n- Observação do médico: ${e.medical_observation.trim()}`
        : '';
      return `**${e.file_name}** (${analysis.image_type || 'Exame'}):\n${analysis.findings || analysis.description || 'Sem achados'}${analysis.abnormalities ? `\n- Anormalidades: ${analysis.abnormalities}` : ''}${analysis.recommendations ? `\n- Recomendações: ${analysis.recommendations}` : ''}${obs}`;
    }).join('\n\n');

  const handleUpdateLaudoWithExams = async () => {
    const analyzedExams = exams.filter(e => e.ai_analysis);
    if (analyzedExams.length === 0) {
      toast({ title: "Sem análises", description: "Aguarde a análise dos exames antes de atualizar o laudo", variant: "destructive" });
      return;
    }

    setUpdatingLaudo(true);
    try {
      const examSummary = buildExamSummary(analyzedExams);

      const { data: currentLaudo, error: fetchError } = await supabase
        .from('laudos')
        .select('sections, pdf_version')
        .eq('id', laudoId)
        .single();

      if (fetchError) throw fetchError;

      const currentSections = (currentLaudo?.sections as any) || {};
      const updatedSections = {
        ...currentSections,
        exames_complementares: examSummary,
        exames_uploads: analyzedExams.map(e => ({
          file_name: e.file_name,
          file_type: e.file_type,
          analysis: e.ai_analysis,
          medical_observation: e.medical_observation || null,
        })),
      };

      const { error: updateError } = await supabase
        .from('laudos')
        .update({
          sections: updatedSections as any,
          complementary_exams: analyzedExams.map(e => `${e.file_name}: ${e.ai_analysis?.description || 'Analisado'}`),
          pdf_version: (currentLaudo?.pdf_version || 1) + 1,
          last_update_type: 'exam_update',
        })
        .eq('id', laudoId);

      if (updateError) throw updateError;

      onExamsAnalyzed?.(examSummary);

      toast({ title: "Laudo atualizado!", description: "A seção de exames complementares foi preenchida com base nas análises" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingLaudo(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
    return <ImageIcon className="w-5 h-5 text-blue-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Exames Complementares - Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Envie exames do paciente (PDF, JPG, PNG). A IA correlaciona imagem + sua observação + contexto da consulta.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          className="w-full border-dashed border-2 h-20"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Upload className="w-5 h-5 mr-2" />
          )}
          {uploading ? 'Enviando...' : 'Clique para enviar exames (PDF, JPG, PNG)'}
        </Button>

        {exams.length > 0 && (
          <div className="space-y-3">
            {exams.map((exam) => (
              <div key={exam.id} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon(exam.file_type)}
                    <span className="text-sm font-medium truncate max-w-[200px]">{exam.file_name}</span>
                    {exam.analyzing && (
                      <Badge variant="outline" className="animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        Analisando com IA...
                      </Badge>
                    )}
                    {exam.analyzed_at && !exam.analyzing && (
                      <Badge variant="secondary" className="animate-fade-in">✅ Analisado</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => window.open(exam.file_url, '_blank')}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeExam(exam.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {exam.ai_description && (
                  <div className="bg-muted/50 rounded p-2 text-sm">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Resumo da IA:</p>
                    <p>{exam.ai_description}</p>
                  </div>
                )}

                {exam.ai_analysis?.findings && (
                  <div className="bg-muted/50 rounded p-2 text-sm">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Achados:</p>
                    <p>{exam.ai_analysis.findings}</p>
                  </div>
                )}

                {/* Observação do médico + Reprocessar */}
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    Observação clínica do médico (a IA usará esse contexto ao reprocessar)
                  </label>
                  <Textarea
                    value={exam.medical_observation || ''}
                    onChange={(e) => updateObservation(exam.id, e.target.value)}
                    placeholder="Ex.: paciente refere dor há 3 dias na região, suspeita de fratura por estresse..."
                    className="min-h-[70px] text-sm"
                    disabled={exam.analyzing}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleReprocess(exam)}
                    disabled={exam.analyzing || !exam.medical_observation?.trim()}
                    className="gap-2"
                  >
                    {exam.analyzing ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Reprocessando...</>
                    ) : (
                      <><Sparkles className="w-3 h-3" /> Reprocessar com IA usando observação</>
                    )}
                  </Button>
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <Button
                onClick={handleUpdateLaudoWithExams}
                disabled={updatingLaudo || exams.every(e => e.analyzing)}
                variant="outline"
                className="w-full"
              >
                {updatingLaudo ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Atualizando laudo...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Atualizar seção de exames</>
                )}
              </Button>

              {onRegenerateWithExams && (
                <Button
                  onClick={() => {
                    const analyzedExams = exams.filter(e => e.ai_analysis);
                    if (analyzedExams.length === 0) {
                      toast({ title: "Sem análises", description: "Aguarde a análise dos exames antes de regenerar", variant: "destructive" });
                      return;
                    }
                    onRegenerateWithExams(buildExamSummary(analyzedExams));
                  }}
                  disabled={exams.every(e => e.analyzing) || exams.filter(e => e.ai_analysis).length === 0}
                  className="w-full bg-primary hover:bg-primary/90 gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Regenerar Laudo Completo com Exames + Áudio
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Manual exam description — separate block */}
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3 mt-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Descrição manual de exames
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Use este campo para registrar achados de exames trazidos pelo paciente, imagens
              visualizadas durante a consulta ou informações que não foram captadas no áudio.
            </p>
          </div>
          <Textarea
            value={manualExamText}
            onChange={(e) => setManualExamText(e.target.value)}
            placeholder="Exemplo: Paciente apresentou exame de imagem com presença de..., laudo laboratorial indicando..., radiografia demonstrando..."
            className="min-h-[140px] text-sm bg-background"
            disabled={updatingFromManual}
          />
          <Button
            onClick={handleManualExamUpdate}
            disabled={updatingFromManual || manualExamText.trim().length < 5}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
          >
            {updatingFromManual ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Atualizando laudo com novas informações...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Atualizar Laudo
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
