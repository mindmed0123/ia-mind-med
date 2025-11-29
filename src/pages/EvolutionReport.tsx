import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, TrendingUp, Loader2, Download, 
  Calendar, FileText, Image as ImageIcon, Sparkles,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSubscription } from '@/hooks/useSubscription';
import { ProFeatureGate } from '@/components/pro/ProFeatureGate';

interface Patient {
  id: string;
  name: string;
  birth_date: string | null;
  sex: string | null;
}

interface TimelineEntry {
  date: string;
  type: string;
  title: string;
  findings: string;
}

interface EvolutionReport {
  id: string;
  title: string;
  report_markdown: string;
  timeline_data: TimelineEntry[];
  findings: any;
  evolution_summary: string;
  recommendations: string;
  theoretical_basis: string;
  pdf_url: string | null;
  created_at: string;
}

export default function EvolutionReportPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [report, setReport] = useState<EvolutionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const isPro = subscription?.plan === 'PRO' || subscription?.plan === 'CLINIC';

  useEffect(() => {
    loadData();
  }, [patientId, user]);

  const loadData = async () => {
    if (!user || !patientId) return;

    try {
      // Load patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData as Patient);

      // Load existing report
      const { data: reportData } = await supabase
        .from('evolution_reports')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (reportData) {
        setReport(reportData as unknown as EvolutionReport);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!isPro) {
      toast.error('Relatório evolutivo disponível apenas no plano PRO');
      return;
    }

    if (!patient) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-evolution-report', {
        body: {
          patientId,
          patientName: patient.name,
        }
      });

      if (error) throw error;

      toast.success('Relatório evolutivo gerado!');
      loadData();
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório evolutivo');
    } finally {
      setGenerating(false);
    }
  };

  const exportPdf = async () => {
    if (!report) return;

    try {
      const { data, error } = await supabase.functions.invoke('export-evolution-pdf', {
        body: { reportId: report.id }
      });

      if (error) throw error;

      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Paciente não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Relatório de Evolução
            </h1>
            <p className="text-muted-foreground">Paciente: {patient.name}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={generateReport} 
              disabled={generating || !isPro}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {report ? 'Atualizar' : 'Gerar'} Relatório
                </>
              )}
            </Button>
            {report && (
              <Button variant="outline" onClick={exportPdf}>
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            )}
          </div>
        </div>

        {!isPro ? (
          <ProFeatureGate feature="Relatório de Evolução">
            <Card className="py-12">
              <div className="text-center">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Recurso PRO</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  O Relatório de Evolução analisa automaticamente todos os laudos, imagens e 
                  documentos do paciente para gerar uma visão completa da evolução clínica.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 mb-6">
                  <li>✓ Linha do tempo completa</li>
                  <li>✓ Análise de evolução das imagens</li>
                  <li>✓ Principais achados consolidados</li>
                  <li>✓ Recomendações baseadas no histórico</li>
                  <li>✓ Embasamento teórico científico</li>
                  <li>✓ Exportação em PDF profissional</li>
                </ul>
              </div>
            </Card>
          </ProFeatureGate>
        ) : !report ? (
          <Card className="py-12">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Nenhum relatório gerado</h2>
              <p className="text-muted-foreground mb-4">
                Clique em "Gerar Relatório" para criar um relatório de evolução 
                baseado no histórico do paciente.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Report Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{report.title}</CardTitle>
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(report.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Timeline */}
            {report.timeline_data && report.timeline_data.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Linha do Tempo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {report.timeline_data.map((entry, index) => (
                        <div key={index} className="relative pl-10">
                          <div className="absolute left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            {entry.type === 'image' ? (
                              <ImageIcon className="h-3 w-3 text-white" />
                            ) : (
                              <FileText className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{entry.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {format(new Date(entry.date), "dd/MM/yyyy", { locale: ptBR })}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{entry.findings}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Evolution Summary */}
            {report.evolution_summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Resumo da Evolução
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{report.evolution_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {report.recommendations && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recomendações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{report.recommendations}</p>
                </CardContent>
              </Card>
            )}

            {/* Theoretical Basis */}
            {report.theoretical_basis && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Embasamento Teórico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{report.theoretical_basis}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
