import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';

interface Hypothesis {
  descricao: string;
  probabilidade: 'Alta' | 'Média' | 'Baixa';
  racional: string;
  achados_suporte: string[];
  achados_contra: string[];
  fatores_risco: string[];
  proximos_passos: string[];
  trechos_timestamp?: Array<{ t: string; texto: string }>;
}

interface DynamicLaudoPreviewProps {
  laudo: any;
  isUpdating?: boolean;
}

export const DynamicLaudoPreview = ({ laudo, isUpdating = false }: DynamicLaudoPreviewProps) => {
  const getProbabilityColor = (prob: string) => {
    switch (prob) {
      case 'Alta': return 'bg-red-500';
      case 'Média': return 'bg-yellow-500';
      case 'Baixa': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const renderHypothesis = (hypothesis: Hypothesis, title: string, isPrimary: boolean) => (
    <Card className={isPrimary ? 'border-primary' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge className={getProbabilityColor(hypothesis.probabilidade)}>
            {hypothesis.probabilidade}
          </Badge>
        </div>
        <p className="text-xl font-semibold mt-2">{hypothesis.descricao}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Racional</h4>
          <p className="text-sm text-muted-foreground">{hypothesis.racional}</p>
        </div>

        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Achados de Suporte
          </h4>
          <ul className="space-y-1">
            {hypothesis.achados_suporte?.map((achado, idx) => (
              <li key={idx} className="text-sm text-muted-foreground pl-4">• {achado}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            Achados que Contrariam
          </h4>
          <ul className="space-y-1">
            {hypothesis.achados_contra?.map((achado, idx) => (
              <li key={idx} className="text-sm text-muted-foreground pl-4">• {achado}</li>
            ))}
          </ul>
        </div>

        {hypothesis.fatores_risco && hypothesis.fatores_risco.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Fatores de Risco</h4>
            <ul className="space-y-1">
              {hypothesis.fatores_risco.map((fator, idx) => (
                <li key={idx} className="text-sm text-muted-foreground pl-4">• {fator}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h4 className="font-medium mb-2">Próximos Passos</h4>
          <ul className="space-y-1">
            {hypothesis.proximos_passos?.map((passo, idx) => (
              <li key={idx} className="text-sm text-muted-foreground pl-4">• {passo}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Prévia do Laudo</CardTitle>
          {isUpdating && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Atualizando...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="hipoteses">Hipóteses</TabsTrigger>
            <TabsTrigger value="condutas">Condutas</TabsTrigger>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            <TabsContent value="resumo" className="space-y-4">
              {laudo?.summary?.resumo_clinico ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{laudo.summary.resumo_clinico}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aguardando geração do resumo...
                </p>
              )}
            </TabsContent>

            <TabsContent value="hipoteses" className="space-y-4">
              {laudo?.hypotheses ? (
                <>
                  {laudo.hypotheses.mais_provavel && renderHypothesis(
                    laudo.hypotheses.mais_provavel,
                    '🎯 Hipótese Mais Provável',
                    true
                  )}
                  {laudo.hypotheses.menos_provavel && renderHypothesis(
                    laudo.hypotheses.menos_provavel,
                    '🔍 Hipótese Diferencial (Menos Provável)',
                    false
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aguardando geração das hipóteses...
                </p>
              )}
            </TabsContent>

            <TabsContent value="condutas" className="space-y-4">
              {laudo?.conducts && laudo.conducts.length > 0 ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Condutas Recomendadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {laudo.conducts.map((conduta: string, idx: number) => (
                          <li key={idx} className="text-sm pl-4">• {conduta}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {laudo.complementary_exams && laudo.complementary_exams.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Exames Sugeridos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {laudo.complementary_exams.map((exame: string, idx: number) => (
                            <li key={idx} className="text-sm pl-4">• {exame}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aguardando geração das condutas...
                </p>
              )}
            </TabsContent>

            <TabsContent value="detalhes" className="space-y-4">
              {laudo?.red_flags && laudo.red_flags.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-5 h-5" />
                      Red Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {laudo.red_flags.map((flag: string, idx: number) => (
                        <li key={idx} className="text-sm text-red-900 pl-4">• {flag}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {laudo?.cid10_codes && laudo.cid10_codes.length > 0 && (
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

              {laudo?.legal_disclaimer && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="pt-6">
                    <p className="text-xs text-yellow-900">{laudo.legal_disclaimer}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
};
