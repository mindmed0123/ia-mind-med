import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image as ImageIcon, Loader2, RefreshCw, Trash2, Eye } from "lucide-react";
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
}

interface ExamUploadSectionProps {
  laudoId: string;
  patientId?: string | null;
  patientName?: string;
  onExamsAnalyzed?: (summary: string) => void;
  onRegenerateWithExams?: (examSummary: string) => void;
}

export const ExamUploadSection = ({ laudoId, patientId, patientName, onExamsAnalyzed, onRegenerateWithExams }: ExamUploadSectionProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exams, setExams] = useState<ExamFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [updatingLaudo, setUpdatingLaudo] = useState(false);

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

          if (docError) {
          } else if (doc) {
            docId = doc.id;
          }
        }

        const newExam: ExamFile = {
          id: docId,
          file_name: file.name,
          file_type: file.type,
          file_url: urlData.publicUrl,
          analyzing: false,
        };

        setExams(prev => [...prev, newExam]);

        // Auto-analyze
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

  const analyzeExam = async (exam: ExamFile) => {
    setExams(prev => prev.map(e => e.id === exam.id ? { ...e, analyzing: true } : e));

    try {
      const { data, error } = await supabase.functions.invoke('analyze-image', {
        body: {
          documentId: exam.id,
          imageUrl: exam.file_url,
          patientName: patientName || '',
          patientId: patientId || '',
        }
      });

      if (error) throw error;

      setExams(prev => prev.map(e =>
        e.id === exam.id
          ? { ...e, analyzing: false, ai_description: data.analysis?.description, ai_analysis: data.analysis, analyzed_at: new Date().toISOString() }
          : e
      ));
    } catch (error: any) {
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, analyzing: false } : e));
      toast({ title: "Erro na análise", description: "Não foi possível analisar o exame", variant: "destructive" });
    }
  };

  const removeExam = (id: string) => {
    setExams(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateLaudoWithExams = async () => {
    const analyzedExams = exams.filter(e => e.ai_analysis);
    if (analyzedExams.length === 0) {
      toast({ title: "Sem análises", description: "Aguarde a análise dos exames antes de atualizar o laudo", variant: "destructive" });
      return;
    }

    setUpdatingLaudo(true);
    try {
      // Build exam summary
      const examSummary = analyzedExams.map(e => {
        const analysis = e.ai_analysis;
        return `**${e.file_name}** (${analysis.image_type || 'Exame'}):\n${analysis.findings || analysis.description || 'Sem achados'}${analysis.abnormalities ? `\n- Anormalidades: ${analysis.abnormalities}` : ''}${analysis.recommendations ? `\n- Recomendações: ${analysis.recommendations}` : ''}`;
      }).join('\n\n');

      // Update the laudo sections with exam data
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
          Envie exames do paciente (PDF, JPG, PNG) para que a IA analise e enriqueça o laudo.
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
              <div key={exam.id} className="border rounded-lg p-3 space-y-2">
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
                    const examSummary = analyzedExams.map(e => {
                      const analysis = e.ai_analysis;
                      return `**${e.file_name}** (${analysis.image_type || 'Exame'}):\n${analysis.findings || analysis.description || 'Sem achados'}${analysis.abnormalities ? `\nAnormalidades: ${analysis.abnormalities}` : ''}${analysis.recommendations ? `\nRecomendações: ${analysis.recommendations}` : ''}`;
                    }).join('\n\n');
                    onRegenerateWithExams(examSummary);
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
      </CardContent>
    </Card>
  );
};
