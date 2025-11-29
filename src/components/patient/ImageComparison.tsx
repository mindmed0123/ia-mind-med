import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  GitCompare, Loader2, Calendar, Sparkles, 
  ArrowRight, Check, X
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSubscription } from '@/hooks/useSubscription';
import { ProFeatureGate } from '@/components/pro/ProFeatureGate';

interface Document {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  category: string;
  ai_description: string | null;
  uploaded_at: string;
}

interface ImageComparisonProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComparisonComplete?: (comparison: string) => void;
}

export function ImageComparison({ 
  patientId, 
  patientName,
  open, 
  onOpenChange,
  onComparisonComplete 
}: ImageComparisonProps) {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);

  const isPro = subscription?.plan === 'PRO' || subscription?.plan === 'CLINIC';

  useEffect(() => {
    if (open) {
      loadImages();
    }
  }, [open, patientId, user]);

  const loadImages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .eq('file_type', 'image')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments((data || []) as Document[]);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    if (selectedImages.includes(id)) {
      setSelectedImages(selectedImages.filter(i => i !== id));
    } else if (selectedImages.length < 2) {
      setSelectedImages([...selectedImages, id]);
    } else {
      toast.error('Selecione apenas 2 imagens para comparar');
    }
  };

  const compareImages = async () => {
    if (selectedImages.length !== 2) {
      toast.error('Selecione exatamente 2 imagens');
      return;
    }

    if (!isPro) {
      toast.error('Comparação de imagens disponível apenas no plano PRO');
      return;
    }

    setComparing(true);
    try {
      const image1 = documents.find(d => d.id === selectedImages[0]);
      const image2 = documents.find(d => d.id === selectedImages[1]);

      if (!image1 || !image2) return;

      const { data, error } = await supabase.functions.invoke('compare-images', {
        body: {
          image1Url: image1.file_url,
          image2Url: image2.file_url,
          image1Date: image1.uploaded_at,
          image2Date: image2.uploaded_at,
          image1Category: image1.category,
          image2Category: image2.category,
          patientName,
        }
      });

      if (error) throw error;

      setComparisonResult(data.comparison);
      if (onComparisonComplete) {
        onComparisonComplete(data.comparison);
      }
    } catch (error) {
      console.error('Error comparing images:', error);
      toast.error('Erro ao comparar imagens');
    } finally {
      setComparing(false);
    }
  };

  const image1 = documents.find(d => d.id === selectedImages[0]);
  const image2 = documents.find(d => d.id === selectedImages[1]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Comparar Imagens
          </DialogTitle>
        </DialogHeader>

        {!isPro ? (
          <ProFeatureGate feature="Comparação de imagens">
            <div className="py-8 text-center">
              <GitCompare className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Recurso PRO</h3>
              <p className="text-muted-foreground">
                A comparação de imagens com análise de evolução está disponível apenas no plano PRO.
              </p>
            </div>
          </ProFeatureGate>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : documents.length < 2 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>É necessário ter pelo menos 2 imagens para comparar.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Image Selection */}
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione 2 imagens para comparar a evolução:
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {documents.map((doc) => (
                  <Card 
                    key={doc.id}
                    className={`cursor-pointer transition-all ${
                      selectedImages.includes(doc.id) 
                        ? 'ring-2 ring-primary' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => toggleSelection(doc.id)}
                  >
                    <div className="aspect-square relative">
                      <img 
                        src={doc.file_url}
                        alt={doc.file_name}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      {selectedImages.includes(doc.id) && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-2">
                      <Badge variant="outline" className="text-xs mb-1">
                        {doc.category}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(doc.uploaded_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Selected Images Preview */}
            {selectedImages.length === 2 && image1 && image2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Imagens Selecionadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <img 
                        src={image1.file_url}
                        alt=""
                        className="w-40 h-40 object-cover rounded-lg mx-auto"
                      />
                      <p className="text-sm mt-2 font-medium">Imagem 1</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(image1.uploaded_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    
                    <ArrowRight className="h-8 w-8 text-muted-foreground" />
                    
                    <div className="text-center">
                      <img 
                        src={image2.file_url}
                        alt=""
                        className="w-40 h-40 object-cover rounded-lg mx-auto"
                      />
                      <p className="text-sm mt-2 font-medium">Imagem 2</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(image2.uploaded_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <Button onClick={compareImages} disabled={comparing}>
                      {comparing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Comparar com IA
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comparison Result */}
            {comparisonResult && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Análise Comparativa da IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{comparisonResult}</p>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm"
                      onClick={() => {
                        if (onComparisonComplete) {
                          onComparisonComplete(comparisonResult);
                        }
                        toast.success('Comparação adicionada ao laudo');
                        onOpenChange(false);
                      }}
                    >
                      Incluir no Laudo
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(comparisonResult);
                        toast.success('Copiado!');
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
