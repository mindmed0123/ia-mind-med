import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Upload, Image as ImageIcon, FileText, Trash2, Eye, 
  Calendar, Tag, MessageSquare, Loader2, Sparkles, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProFeatureGate } from '@/components/pro/ProFeatureGate';
import { useSubscription } from '@/hooks/useSubscription';

interface PatientDocument {
  id: string;
  patient_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
  ai_description: string | null;
  ai_analysis: any;
  notes: string | null;
  uploaded_at: string;
  analyzed_at: string | null;
}

interface PatientDocumentsProps {
  patientId: string;
  patientName: string;
}

const CATEGORIES = [
  { value: 'xray', label: 'Raio-X' },
  { value: 'tomography', label: 'Tomografia' },
  { value: 'ultrasound', label: 'Ultrassonografia' },
  { value: 'mri', label: 'Ressonância Magnética' },
  { value: 'lab_result', label: 'Resultado de Laboratório' },
  { value: 'prescription', label: 'Receita Antiga' },
  { value: 'clinical_report', label: 'Laudo Clínico' },
  { value: 'lesion_photo', label: 'Foto de Lesão' },
  { value: 'other', label: 'Outro' },
];

export function PatientDocuments({ patientId, patientName }: PatientDocumentsProps) {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [selectedDocument, setSelectedDocument] = useState<PatientDocument | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const isPro = subscription?.plan === 'PRO' || subscription?.plan === 'CLINIC';
  const uploadLimit = isPro ? Infinity : 1;
  const todayUploads = documents.filter(d => {
    const uploadDate = new Date(d.uploaded_at);
    const today = new Date();
    return uploadDate.toDateString() === today.toDateString();
  }).length;

  useEffect(() => {
    loadDocuments();
  }, [patientId, user]);

  const loadDocuments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments((data || []) as PatientDocument[]);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Check upload limit for non-PRO users
    if (!isPro && todayUploads >= uploadLimit) {
      toast.error('Limite de upload atingido. Atualize para o plano PRO para uploads ilimitados.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use JPG, PNG, WebP ou PDF.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 50MB.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${patientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('patient-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('patient-documents')
        .getPublicUrl(fileName);

      const { data: signedData } = await supabase.storage
        .from('patient-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      const fileUrl = signedData?.signedUrl || publicUrl;

      const { data: docData, error: docError } = await supabase
        .from('patient_documents')
        .insert({
          patient_id: patientId,
          user_id: user.id,
          file_url: fileUrl,
          file_name: file.name,
          file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
          file_size: file.size,
          category: selectedCategory,
        })
        .select()
        .single();

      if (docError) throw docError;

      toast.success('Documento enviado com sucesso!');
      loadDocuments();

      // Auto-analyze if PRO
      if (isPro && docData && file.type.startsWith('image/')) {
        analyzeDocument(docData.id, fileUrl);
      }
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const analyzeDocument = async (documentId: string, fileUrl: string) => {
    if (!isPro) {
      toast.error('Análise avançada disponível apenas no plano PRO');
      return;
    }

    setAnalyzing(documentId);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-image', {
        body: { 
          documentId, 
          imageUrl: fileUrl,
          patientName,
          patientId 
        }
      });

      if (error) throw error;

      toast.success('Análise concluída!');
      loadDocuments();
    } catch (error) {
      console.error('Error analyzing:', error);
      toast.error('Erro ao analisar documento');
    } finally {
      setAnalyzing(null);
    }
  };

  const updateNotes = async (documentId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('patient_documents')
        .update({ notes })
        .eq('id', documentId);

      if (error) throw error;
      toast.success('Anotação salva!');
      loadDocuments();
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Erro ao salvar anotação');
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;

    try {
      const { error } = await supabase
        .from('patient_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      toast.success('Documento excluído!');
      loadDocuments();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir documento');
    }
  };

  const filteredDocuments = filterCategory === 'all' 
    ? documents 
    : documents.filter(d => d.category === filterCategory);

  const getCategoryLabel = (value: string) => 
    CATEGORIES.find(c => c.value === value)?.label || value;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Enviar Documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>
          </div>

          {!isPro && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>
                {todayUploads}/{uploadLimit} upload(s) hoje. 
                <Button variant="link" className="h-auto p-0 ml-1 text-primary">
                  Upgrade para PRO
                </Button> para uploads ilimitados.
              </span>
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando documento...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Filtrar por:</span>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredDocuments.length} documento(s)
        </span>
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <Card className="py-12">
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum documento encontrado</p>
            <p className="text-sm">Envie imagens ou PDFs do paciente</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              {/* Preview */}
              <div className="aspect-video bg-muted relative group">
                {doc.file_type === 'image' ? (
                  <img 
                    src={doc.file_url} 
                    alt={doc.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setEditNotes(doc.notes || '');
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{doc.file_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {doc.file_type === 'image' ? (
                          <img 
                            src={doc.file_url} 
                            alt={doc.file_name}
                            className="w-full rounded-lg"
                          />
                        ) : (
                          <iframe 
                            src={doc.file_url}
                            className="w-full h-[60vh] rounded-lg"
                          />
                        )}

                        {/* AI Analysis */}
                        {doc.ai_description && (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Análise da IA
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm">{doc.ai_description}</p>
                              {doc.ai_analysis && (
                                <div className="mt-4 space-y-2">
                                  {doc.ai_analysis.findings && (
                                    <div>
                                      <span className="font-medium text-sm">Achados:</span>
                                      <p className="text-sm text-muted-foreground">
                                        {doc.ai_analysis.findings}
                                      </p>
                                    </div>
                                  )}
                                  {doc.ai_analysis.recommendations && (
                                    <div>
                                      <span className="font-medium text-sm">Recomendações:</span>
                                      <p className="text-sm text-muted-foreground">
                                        {doc.ai_analysis.recommendations}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Anotações</label>
                          <Textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Adicione suas observações..."
                            rows={3}
                          />
                          <Button 
                            size="sm"
                            onClick={() => updateNotes(doc.id, editNotes)}
                          >
                            Salvar Anotação
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {doc.file_type === 'image' && isPro && !doc.ai_description && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => analyzeDocument(doc.id, doc.file_url)}
                      disabled={analyzing === doc.id}
                    >
                      {analyzing === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* AI Badge */}
                {doc.ai_description && (
                  <Badge className="absolute top-2 right-2 bg-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    IA
                  </Badge>
                )}
              </div>

              {/* Info */}
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium truncate">{doc.file_name}</p>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {getCategoryLabel(doc.category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(doc.uploaded_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>

                {doc.ai_description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {doc.ai_description}
                  </p>
                )}

                {doc.notes && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-1">{doc.notes}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* PRO Features Gate */}
      {!isPro && documents.length > 0 && (
        <ProFeatureGate feature="Análise avançada de imagens">
          <Card className="p-6 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="font-semibold mb-2">Análise Visual com IA</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Desbloqueie análise automática de raio-x, tomografias e fotos clínicas, 
              comparação histórica de imagens e inclusão automática nos laudos.
            </p>
          </Card>
        </ProFeatureGate>
      )}
    </div>
  );
}
