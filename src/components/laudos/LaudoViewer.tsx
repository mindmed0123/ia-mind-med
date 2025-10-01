import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, FileText, User, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface LaudoViewerProps {
  laudoId: string;
}

export const LaudoViewer = ({ laudoId }: LaudoViewerProps) => {
  const { toast } = useToast();
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
              <div className="flex gap-2">
                <Badge variant="outline">{laudo.ai_model || 'gpt-5'}</Badge>
                <Badge variant="outline" className="capitalize">{laudo.status}</Badge>
              </div>
            </div>
          {laudo.patient_data && (
            <div className="text-sm text-muted-foreground mt-2">
              Paciente: {laudo.patient_data.iniciais} • {laudo.patient_data.sexo} • {laudo.patient_data.idade} anos
            </div>
          )}
        </CardHeader>
      </Card>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="laudo">
            <FileText className="w-4 h-4 mr-2" />
            Laudo
          </TabsTrigger>
          <TabsTrigger value="paciente">
            <User className="w-4 h-4 mr-2" />
            Paciente
          </TabsTrigger>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
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

        <TabsContent value="detalhes">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes Técnicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Modelo de IA</h4>
                <p className="text-sm text-muted-foreground">{laudo.ai_model || 'gpt-5'}</p>
              </div>

              {laudo.ai_usage && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Uso de Tokens</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Prompt</p>
                        <p className="font-mono">{laudo.ai_usage.prompt_tokens || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Resposta</p>
                        <p className="font-mono">{laudo.ai_usage.completion_tokens || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-mono">{laudo.ai_usage.total_tokens || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Latência</p>
                        <p className="font-mono">{laudo.ai_usage.latency_ms || 0}ms</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div>
                <h4 className="font-medium mb-2">Timestamps</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Criado:</span> {new Date(laudo.created_at).toLocaleString('pt-BR')}</p>
                  <p><span className="text-muted-foreground">Atualizado:</span> {new Date(laudo.updated_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Dados Estruturados (JSON)</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(laudo, null, 2))}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{JSON.stringify(laudo, null, 2)}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 justify-end">
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Baixar PDF
        </Button>
        <Button>
          Salvar Laudo
        </Button>
      </div>
    </div>
  );
};