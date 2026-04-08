import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, FileText, User, AlertTriangle, Pill, Crown, Stethoscope, ClipboardList, FlaskConical, ShieldAlert, Activity, Sparkles, Clock, Brain, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/hooks/useSubscription";

interface LaudoSectionConfig {
  key: string;
  label: string;
  enabled: boolean;
}

interface LaudoViewerProps {
  laudoId: string;
  refreshKey?: number;
  visibleSections?: LaudoSectionConfig[];
}

/* ── Reusable Section Block with entrance animation ── */
const SectionBlock = ({ num, icon: Icon, title, children, variant = 'default', delay = 0 }: {
  num?: string;
  icon: any;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'alert' | 'highlight';
  delay?: number;
}) => (
  <div 
    className={`rounded-xl border overflow-hidden transition-all animate-fade-in ${
      variant === 'alert' ? 'border-destructive/30 bg-destructive/5' :
      variant === 'highlight' ? 'border-primary/30 bg-primary/5' :
      'border-border/60 bg-card'
    }`}
    style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
  >
    <div className={`flex items-center gap-3 px-5 py-3 border-b ${
      variant === 'alert' ? 'border-destructive/20 bg-destructive/10' :
      variant === 'highlight' ? 'border-primary/20 bg-primary/10' :
      'border-border/40 bg-muted/30'
    }`}>
      {num && (
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground ${
          variant === 'alert' ? 'bg-destructive' : 'bg-primary'
        }`}>{num}</span>
      )}
      <Icon className={`w-4 h-4 ${variant === 'alert' ? 'text-destructive' : 'text-primary'}`} />
      <h3 className={`font-semibold text-sm uppercase tracking-wider ${
        variant === 'alert' ? 'text-destructive' : 'text-foreground'
      }`}>{title}</h3>
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

export const LaudoViewer = ({ laudoId, refreshKey, visibleSections }: LaudoViewerProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [laudo, setLaudo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLaudo(); }, [laudoId, refreshKey]);

  const loadLaudo = async () => {
    // Only show full loading spinner on initial load, not on refreshKey updates
    if (!laudo) setLoading(true);
    try {
      const { data, error } = await supabase.from('laudos').select('*').eq('id', laudoId).single();
      if (error) throw error;
      setLaudo(data);
    } catch (error) {
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
        }).catch(() => {});
      }
    } catch (error: any) {
        toast({ title: "Erro ao gerar PDF", description: error.message || 'Não foi possível gerar o PDF', variant: "destructive" });
      }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando laudo...</p>
        </div>
      </div>
    );
  }

  if (!laudo) {
    return (
      <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Laudo não encontrado</p></CardContent></Card>
    );
  }

  const sections = laudo.sections || {};
  const hypotheses = laudo.hypotheses as any;
  const patientData = laudo.patient_data as any;

  let sectionIdx = 1;
  const nextNum = () => String(sectionIdx++).padStart(2, '0');

  // Estimate time saved based on report length (deterministic, not random)
  const reportLength = (laudo.report_markdown || '').length;
  const timeSaved = Math.max(12, Math.min(25, Math.floor(reportLength / 200) + 12));

  // Section visibility helper - if no config provided, show all
  const isSectionVisible = (key: string) => {
    if (!visibleSections || visibleSections.length === 0) return true;
    const section = visibleSections.find(s => s.key === key);
    return section ? section.enabled : true;
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border border-primary/15 px-5 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <Badge className="bg-primary/15 text-primary border-0 gap-1.5 font-medium">
            <Sparkles className="w-3 h-3" /> Gerado por IA
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
            <CheckCircle className="w-3 h-3" /> Completed
          </Badge>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> Você economizou ~{timeSaved} min
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1.5 text-xs h-8">
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          {laudo.status === 'completed' && laudo.sections?.hipoteses?.principal && (
            subscription?.isPro ? (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
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
              >
                <Pill className="w-3.5 h-3.5" /> Receituário
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => navigate('/precos')} className="gap-1.5 text-xs h-8 border-primary/50">
                <Crown className="w-3.5 h-3.5 text-primary" /> Receituário PRO
              </Button>
            )
          )}
        </div>
      </div>

      {/* ── Patient ID Card ── */}
      {patientData && isSectionVisible('patient_card') && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Paciente</p>
            <p className="text-sm font-bold text-foreground">{patientData.nome_completo || patientData.iniciais || '—'}</p>
          </div>
          {patientData.idade && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Idade</p>
              <p className="text-sm font-semibold text-foreground">{patientData.idade} anos</p>
            </div>
          )}
          {patientData.sexo && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Sexo</p>
              <p className="text-sm font-semibold text-foreground">{patientData.sexo === 'M' ? 'Masculino' : patientData.sexo === 'F' ? 'Feminino' : patientData.sexo}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Data</p>
            <p className="text-sm font-semibold text-foreground">{new Date(laudo.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="resumo" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Brain className="w-4 h-4" /> Resumo Clínico
          </TabsTrigger>
          <TabsTrigger value="laudo" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4" /> Laudo Completo
          </TabsTrigger>
          <TabsTrigger value="paciente" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="w-4 h-4" /> Paciente
          </TabsTrigger>
        </TabsList>

        {/* ══════ TAB: RESUMO ══════ */}
        <TabsContent value="resumo" className="space-y-4 mt-5">

          {/* AI Microcopy */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>Análise clínica automatizada • Alta precisão</span>
          </div>

          {/* Specialty sections */}
          {laudo.sections?.template_sections && laudo.sections.template_sections.length > 0 && laudo.sections?.specialty_sections && (
            <SectionBlock icon={Stethoscope} title="Seções da Especialidade" delay={50}>
              <div className="space-y-3">
                {(laudo.sections.template_sections as any[])
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((section: any) => {
                    const value = laudo.sections.specialty_sections[section.key];
                    if (!value) return null;
                    return (
                      <div key={section.key} className="pb-3 border-b border-border/40 last:border-0">
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
          {isSectionVisible('anamnese') && (sections.queixa || sections.hda || laudo.summary?.resumo_clinico) && (
            <SectionBlock num={nextNum()} icon={Stethoscope} title="Anamnese" delay={100}>
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

          {/* Hipótese Diagnóstica — PREMIUM BLOCK */}
          {isSectionVisible('hipotese') && (sections.hipoteses?.principal || hypotheses?.mais_provavel || laudo.diagnosis_main) && (
            <SectionBlock num={nextNum()} icon={Activity} title="Hipótese Diagnóstica" variant="highlight" delay={200}>
              <div className="space-y-3">
                {/* Principal */}
                <div className="rounded-xl border-2 border-primary/30 overflow-hidden bg-primary/5">
                  <div className="bg-primary/15 px-4 py-2 flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Hipótese Principal</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm font-bold text-foreground leading-relaxed">
                      {sections.hipoteses?.principal || hypotheses?.mais_provavel?.descricao || laudo.diagnosis_main}
                    </p>
                    {hypotheses?.mais_provavel?.racional && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{hypotheses.mais_provavel.racional}</p>
                    )}
                  </div>
                </div>

                {/* Diferencial */}
                {isSectionVisible('diferencial') && (sections.hipoteses?.diferencial || hypotheses?.menos_provavel) && (
                  <div className="rounded-xl border border-border/60 overflow-hidden bg-muted/20">
                    <div className="bg-muted/40 px-4 py-2">
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
          {isSectionVisible('cid10') && laudo.cid10_codes && laudo.cid10_codes.length > 0 && (
            <SectionBlock icon={ClipboardList} title="Classificação CID-10" delay={250}>
              <div className="flex flex-wrap gap-2">
                {laudo.cid10_codes.map((cid: string, idx: number) => (
                  <Badge key={idx} className="bg-primary text-primary-foreground font-bold tracking-wider px-3 py-1 rounded-lg">{cid}</Badge>
                ))}
              </div>
            </SectionBlock>
          )}

          {/* Red Flags */}
          {isSectionVisible('red_flags') && laudo.red_flags && laudo.red_flags.length > 0 && (
            <SectionBlock icon={ShieldAlert} title="Sinais de Alerta" variant="alert" delay={300}>
              <ul className="space-y-2.5">
                {laudo.red_flags.map((flag: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <span className="text-destructive font-medium">{flag}</span>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          )}

          {/* Exames Complementares */}
          {isSectionVisible('exames') && laudo.complementary_exams && laudo.complementary_exams.length > 0 && (
            <SectionBlock num={nextNum()} icon={FlaskConical} title="Exames Complementares" delay={350}>
              <ul className="space-y-2">
                {laudo.complementary_exams.map((exame: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-sm py-1.5 border-b border-border/30 last:border-0">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                    <span className="text-foreground">{exame}</span>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          )}

          {/* Conduta */}
          {isSectionVisible('conduta') && (laudo.conducts?.length > 0 || sections.conduta) && (
            <SectionBlock num={nextNum()} icon={ClipboardList} title="Conduta" variant="highlight" delay={400}>
              {sections.conduta ? (
                <p className="text-sm text-foreground leading-relaxed font-medium whitespace-pre-wrap">{sections.conduta}</p>
              ) : (
                <ul className="space-y-2.5">
                  {laudo.conducts.map((conduta: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-sm py-1">
                      <span className="w-6 h-6 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                      <span className="text-foreground font-medium">{conduta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionBlock>
          )}
        </TabsContent>

        {/* ══════ TAB: LAUDO COMPLETO ══════ */}
        <TabsContent value="laudo" className="mt-5">
          <Card className="rounded-xl border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Laudo Médico Completo</CardTitle>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> IA
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(laudo.report_markdown || '')} className="h-8 text-xs gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copiar
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
        <TabsContent value="paciente" className="mt-5">
          <Card className="rounded-xl border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Resumo para o Paciente</CardTitle>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(laudo.patient_markdown || '')} className="h-8 text-xs gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copiar
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
    </div>
  );
};
