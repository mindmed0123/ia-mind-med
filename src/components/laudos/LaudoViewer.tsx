import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, FileText, User, AlertTriangle, Pill, Crown, Stethoscope, ClipboardList, FlaskConical, ShieldAlert, Activity } from "lucide-react";
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
      toast({ title: "Erro ao carregar laudo", description: "Não foi possível carregar os dados do laudo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência" });
  };

  const handleDownloadPdf = async () => {
    try {
      toast({ title: "Gerando PDF...", description: "Aguarde enquanto o documento é gerado." });
      const { data, error } = await supabase.functions.invoke('export-pdf', { body: { laudo_id: laudoId } });
      if (error) throw error;

      if (data?.html && data?.verifyToken) {
        const { generatePdf, downloadPdf } = await import('@/lib/pdf-generator');
        const baseUrl = window.location.origin;
        const verifyUrl = `${baseUrl}/api/verify-pdf/${laudoId}?token=${data.verifyToken}`;
        const pdfBlob = await generatePdf({ html: data.html, fileName: data.fileName, verifyUrl, pdfMeta: data.pdfMeta });
        downloadPdf(pdfBlob, data.fileName);
        toast({ title: "PDF gerado!", description: "O documento foi gerado e baixado com sucesso." });

        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'pdf-exported',
            recipientEmail: (await supabase.auth.getUser()).data.user?.email,
            idempotencyKey: `pdf-exported-${laudoId}-${Date.now()}`,
            templateData: { doctorName: data.pdfMeta?.doctorName, laudoTitle: data.fileName?.replace('.pdf', '') },
          },
        }).catch(err => console.error('PDF export email failed:', err));
      }
    } catch (error: any) {
      console.error('Erro ao exportar PDF:', error);
      toast({ title: "Erro ao gerar PDF", description: error.message || 'Não foi possível gerar o PDF', variant: "destructive" });
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

  const sections = laudo.sections || {};
  const hypotheses = laudo.hypotheses as any;
  const patientData = laudo.patient_data as any;

  // ── Section Component ──
  const SectionBlock = ({ num, icon: Icon, title, children, variant = 'default' }: {
    num?: string;
    icon: any;
    title: string;
    children: React.ReactNode;
    variant?: 'default' | 'alert' | 'highlight';
  }) => (
    <div className={`rounded-lg border overflow-hidden ${
      variant === 'alert' ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30' :
      variant === 'highlight' ? 'border-primary/30 bg-primary/5' :
      'border-border bg-card'
    }`}>
      <div className={`flex items-center gap-3 px-5 py-3 border-b ${
        variant === 'alert' ? 'border-red-200 dark:border-red-900 bg-red-100/50 dark:bg-red-950/50' :
        variant === 'highlight' ? 'border-primary/20 bg-primary/10' :
        'border-border bg-muted/30'
      }`}>
        {num && (
          <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-primary-foreground ${
            variant === 'alert' ? 'bg-red-600' :
            variant === 'highlight' ? 'bg-primary' :
            'bg-primary'
          }`}>{num}</span>
        )}
        <Icon className={`w-4 h-4 ${
          variant === 'alert' ? 'text-red-600 dark:text-red-400' : 'text-primary'
        }`} />
        <h3 className={`font-semibold text-sm uppercase tracking-wider ${
          variant === 'alert' ? 'text-red-700 dark:text-red-300' : 'text-foreground'
        }`}>{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );

  let sectionIdx = 1;
  const nextNum = () => String(sectionIdx++).padStart(2, '0');

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* ── Header Card ── */}
      <Card className="border-primary/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-amber-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight">Laudo Médico</CardTitle>
            <Badge variant={laudo.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
              {laudo.status === 'completed' ? 'Finalizado' : laudo.status}
            </Badge>
          </div>
          {patientData && (
            <div className="flex flex-wrap gap-3 mt-2">
              <Badge variant="outline" className="text-xs font-medium">
                {patientData.nome_completo || patientData.iniciais || 'Paciente'}
              </Badge>
              {patientData.sexo && <Badge variant="outline" className="text-xs">{patientData.sexo}</Badge>}
              {patientData.idade && <Badge variant="outline" className="text-xs">{patientData.idade} anos</Badge>}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* ── Tabs ── */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resumo">Resumo Clínico</TabsTrigger>
          <TabsTrigger value="laudo">
            <FileText className="w-4 h-4 mr-2" />Laudo Completo
          </TabsTrigger>
          <TabsTrigger value="paciente">
            <User className="w-4 h-4 mr-2" />Paciente
          </TabsTrigger>
        </TabsList>

        {/* ══════ TAB: RESUMO ══════ */}
        <TabsContent value="resumo" className="space-y-4 mt-4">

          {/* Specialty sections */}
          {laudo.sections?.template_sections && laudo.sections.template_sections.length > 0 && laudo.sections?.specialty_sections && (
            <SectionBlock icon={Stethoscope} title="Seções da Especialidade">
              <div className="space-y-3">
                {(laudo.sections.template_sections as any[])
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((section: any) => {
                    const value = laudo.sections.specialty_sections[section.key];
                    if (!value) return null;
                    return (
                      <div key={section.key} className="pb-3 border-b border-border last:border-0">
                        <h4 className="font-semibold text-xs text-primary uppercase tracking-wide mb-1">{section.label}</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </SectionBlock>
          )}

          {/* Anamnese */}
          {(sections.queixa || sections.hda || laudo.summary?.resumo_clinico) && (
            <SectionBlock num={nextNum()} icon={Stethoscope} title="Anamnese">
              <div className="space-y-4">
                {sections.queixa && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Queixa Principal</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{sections.queixa}</p>
                  </div>
                )}
                {(sections.hda || laudo.summary?.resumo_clinico) && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">História da Doença Atual</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.hda || laudo.summary?.resumo_clinico}</p>
                  </div>
                )}
              </div>
            </SectionBlock>
          )}

          {/* Hipótese Diagnóstica */}
          {(sections.hipoteses?.principal || hypotheses?.mais_provavel || laudo.diagnosis_main) && (
            <SectionBlock num={nextNum()} icon={Activity} title="Hipótese Diagnóstica" variant="highlight">
              <div className="space-y-3">
                {/* Principal */}
                <div className="rounded-lg border-2 border-primary/30 overflow-hidden">
                  <div className="bg-primary/10 px-4 py-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Hipótese Principal</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-foreground leading-relaxed">
                      {sections.hipoteses?.principal || hypotheses?.mais_provavel?.descricao || laudo.diagnosis_main}
                    </p>
                    {hypotheses?.mais_provavel?.racional && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{hypotheses.mais_provavel.racional}</p>
                    )}
                  </div>
                </div>

                {/* Diferencial */}
                {(sections.hipoteses?.diferencial || hypotheses?.menos_provavel) && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Diagnóstico Diferencial</span>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-foreground leading-relaxed">
                        {sections.hipoteses?.diferencial || hypotheses?.menos_provavel?.descricao || laudo.diagnosis_diff}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </SectionBlock>
          )}

          {/* CID-10 */}
          {laudo.cid10_codes && laudo.cid10_codes.length > 0 && (
            <SectionBlock icon={ClipboardList} title="Classificação CID-10">
              <div className="flex flex-wrap gap-2">
                {laudo.cid10_codes.map((cid: string, idx: number) => (
                  <Badge key={idx} className="bg-primary text-primary-foreground font-semibold tracking-wide px-3 py-1">{cid}</Badge>
                ))}
              </div>
            </SectionBlock>
          )}

          {/* Red Flags */}
          {laudo.red_flags && laudo.red_flags.length > 0 && (
            <SectionBlock icon={ShieldAlert} title="Sinais de Alerta" variant="alert">
              <ul className="space-y-2">
                {laudo.red_flags.map((flag: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-red-700 dark:text-red-300">{flag}</span>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          )}

          {/* Exames Complementares */}
          {laudo.complementary_exams && laudo.complementary_exams.length > 0 && (
            <SectionBlock num={nextNum()} icon={FlaskConical} title="Exames Complementares">
              <ul className="space-y-2">
                {laudo.complementary_exams.map((exame: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-sm py-1 border-b border-border/50 last:border-0">
                    <span className="text-primary font-bold">→</span>
                    <span className="text-foreground">{exame}</span>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          )}

          {/* Conduta */}
          {(laudo.conducts?.length > 0 || sections.conduta) && (
            <SectionBlock num={nextNum()} icon={ClipboardList} title="Conduta" variant="highlight">
              {sections.conduta ? (
                <p className="text-sm text-foreground leading-relaxed font-medium whitespace-pre-wrap">{sections.conduta}</p>
              ) : (
                <ul className="space-y-2">
                  {laudo.conducts.map((conduta: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-sm py-1">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                      <span className="text-foreground font-medium">{conduta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionBlock>
          )}
        </TabsContent>

        {/* ══════ TAB: LAUDO COMPLETO ══════ */}
        <TabsContent value="laudo" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Laudo Médico Completo</CardTitle>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(laudo.report_markdown || '')}>
                  <Copy className="w-4 h-4 mr-2" />Copiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-primary prose-strong:text-foreground">
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

        {/* ══════ TAB: PACIENTE ══════ */}
        <TabsContent value="paciente" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Resumo para o Paciente</CardTitle>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(laudo.patient_markdown || '')}>
                  <Copy className="w-4 h-4 mr-2" />Copiar
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

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-2 justify-end">
        {laudo.status === 'completed' && laudo.sections?.hipoteses?.principal && (
          subscription?.isPro ? (
            <Button
              variant="outline"
              onClick={() => {
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
              <Pill className="w-4 h-4" />Gerar Receituário
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate('/precos')} className="gap-2 border-primary/50">
              <Crown className="w-4 h-4 text-primary" />Gerar Receituário (PRO)
            </Button>
          )
        )}
        <Button variant="outline" onClick={handleDownloadPdf}>
          <Download className="w-4 h-4 mr-2" />Baixar PDF
        </Button>
      </div>
    </div>
  );
};
