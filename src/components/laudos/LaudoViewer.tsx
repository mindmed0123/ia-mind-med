import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, FileText, User, AlertTriangle, Pill, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/hooks/useSubscription";

interface LaudoViewerProps {
  laudoId: string;
}

export const LaudoViewer = ({ laudoId }: LaudoViewerProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [laudo, setLaudo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLaudo();
  }, [laudoId]);

  const loadLaudo = async () => {
    try {
      const { data, error } = await supabase
        .from('laudos')
        .select('*')
        .eq('id', laudoId)
        .single();

      if (error) throw error;
      setLaudo(data);
    } catch (error) {
      console.error('Erro ao carregar laudo:', error);
      toast({
        title: "Erro ao carregar laudo",
        description: "Não foi possível carregar os dados do laudo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Texto copiado para a área de transferência",
    });
  };

  const handleDownloadPdf = async () => {
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
        const { generatePdf, downloadPdf } = await import('@/lib/pdf-generator');
        
        const baseUrl = window.location.origin;
        const verifyUrl = `${baseUrl}/api/verify-pdf/${laudoId}?token=${data.verifyToken}`;
        
        const pdfBlob = await generatePdf({
          html: data.html,
          fileName: data.fileName,
          verifyUrl
        });

        downloadPdf(pdfBlob, data.fileName);

        toast({
          title: "PDF gerado!",
          description: "O documento foi gerado e baixado com sucesso.",
        });
      }
    } catch (error: any) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message || 'Não foi possível gerar o PDF',
        variant: "destructive"
      });
    }
  };

  const handleSaveLaudo = async () => {
    try {
      // Verificar se o laudo já está finalizado
      if (laudo.status !== 'completed') {
        toast({
          title: "Finalize o laudo",
          description: "O laudo precisa ser finalizado antes de salvar.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Laudo salvo",
        description: "O laudo já está salvo no sistema.",
      });
    } catch (error: any) {
      console.error('Erro ao salvar laudo:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando laudo...</p>
        </div>
      </div>
    );
  }

  if (!laudo) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Laudo não encontrado</p>
        </CardContent>
      </Card>
    );
  }

  const getProbabilityColor = (prob: string) => {
    switch (prob) {
      case 'Alta': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Média': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Baixa': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Laudo Gerado por IA</CardTitle>
              <Badge variant="outline" className="capitalize">{laudo.status}</Badge>
            </div>
          {laudo.patient_data && (
            <div className="text-sm text-muted-foreground mt-2">
              Paciente: {laudo.patient_data.iniciais} • {laudo.patient_data.sexo} • {laudo.patient_data.idade} anos
            </div>
          )}
        </CardHeader>
      </Card>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="laudo">
            <FileText className="w-4 h-4 mr-2" />
            Laudo
          </TabsTrigger>
          <TabsTrigger value="paciente">
            <User className="w-4 h-4 mr-2" />
            Paciente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo Clínico</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {laudo.summary?.resumo_clinico || 'Não disponível'}
              </p>
            </CardContent>
          </Card>

        <TabsContent value="hipoteses" className="space-y-4">
          {laudo.hypotheses?.mais_provavel || laudo.hypotheses?.menos_provavel ? (
            <>
              {laudo.hypotheses.mais_provavel && (
                <Card className="border-primary">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">🎯 Mais Provável</CardTitle>
                      <Badge variant="destructive">
                        {laudo.hypotheses.mais_provavel.probabilidade}
                      </Badge>
                    </div>
                    <p className="text-xl font-semibold mt-2">{laudo.hypotheses.mais_provavel.descricao}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {laudo.hypotheses.mais_provavel.racional && (
                      <div>
                        <h4 className="font-medium mb-1">Racional</h4>
                        <p className="text-sm text-muted-foreground">{laudo.hypotheses.mais_provavel.racional}</p>
                      </div>
                    )}
                    {laudo.hypotheses.mais_provavel.achados_suporte?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Achados de Suporte</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {laudo.hypotheses.mais_provavel.achados_suporte.map((achado: string, i: number) => (
                            <li key={i}>• {achado}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {laudo.hypotheses.mais_provavel.proximos_passos?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Próximos Passos</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {laudo.hypotheses.mais_provavel.proximos_passos.map((passo: string, i: number) => (
                            <li key={i}>• {passo}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {laudo.hypotheses.menos_provavel && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">🔍 Diferencial (Menos Provável)</CardTitle>
                      <Badge variant="secondary">
                        {laudo.hypotheses.menos_provavel.probabilidade}
                      </Badge>
                    </div>
                    <p className="text-xl font-semibold mt-2">{laudo.hypotheses.menos_provavel.descricao}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {laudo.hypotheses.menos_provavel.racional && (
                      <div>
                        <h4 className="font-medium mb-1">Racional</h4>
                        <p className="text-sm text-muted-foreground">{laudo.hypotheses.menos_provavel.racional}</p>
                      </div>
                    )}
                    {laudo.hypotheses.menos_provavel.achados_suporte?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Achados de Suporte</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {laudo.hypotheses.menos_provavel.achados_suporte.map((achado: string, i: number) => (
                            <li key={i}>• {achado}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma hipótese disponível</p>
          )}
        </TabsContent>

          {laudo.conducts && laudo.conducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Condutas Recomendadas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {laudo.conducts.map((conduta: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-sm">{conduta}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {laudo.complementary_exams && laudo.complementary_exams.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exames Complementares</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {laudo.complementary_exams.map((exame: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-sm">{exame}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {laudo.red_flags && laudo.red_flags.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Red Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {laudo.red_flags.map((flag: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">⚠</span>
                      <span className="text-sm">{flag}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {laudo.cid10_codes && laudo.cid10_codes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CID-10 Sugeridos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {laudo.cid10_codes.map((cid: string, idx: number) => (
                    <Badge key={idx} variant="secondary">{cid}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="laudo">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Laudo Médico Completo</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(laudo.report_markdown || '')}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{laudo.report_markdown || 'Laudo não disponível'}</ReactMarkdown>
              </div>
              {laudo.legal_disclaimer && (
                <>
                  <Separator className="my-4" />
                  <p className="text-xs text-muted-foreground italic">{laudo.legal_disclaimer}</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paciente">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Resumo para o Paciente</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(laudo.patient_markdown || '')}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{laudo.patient_markdown || 'Resumo não disponível'}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-2 justify-end mt-6">
        {/* Botão Gerar Receituário - Apenas PRO */}
        {laudo.status === 'completed' && laudo.sections?.hipoteses?.principal && (
          subscription?.isPro ? (
            <Button 
              variant="outline" 
              onClick={() => {
                // Store laudo data in sessionStorage for the prescription page
                const prescriptionData = {
                  patient_name: laudo.patient_data?.iniciais || '',
                  diagnosis: laudo.sections?.hipoteses?.principal || '',
                  conduct: laudo.sections?.conduta || '',
                  cid10: laudo.cid10_codes || []
                };
                sessionStorage.setItem('prescriptionFromLaudo', JSON.stringify(prescriptionData));
                navigate('/receituarios?from=laudo');
              }}
              className="gap-2"
            >
              <Pill className="w-4 h-4" />
              Gerar Receituário
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => navigate('/precos')}
              className="gap-2 border-primary/50"
            >
              <Crown className="w-4 h-4 text-primary" />
              Gerar Receituário (PRO)
            </Button>
          )
        )}
        
        <Button variant="outline" onClick={handleDownloadPdf}>
          <Download className="w-4 h-4 mr-2" />
          Baixar PDF
        </Button>
        <Button onClick={handleSaveLaudo} disabled={laudo.status !== 'completed'}>
          {laudo.status === 'completed' ? 'Laudo Salvo' : 'Finalizar para Salvar'}
        </Button>
      </div>
    </div>
  );
};