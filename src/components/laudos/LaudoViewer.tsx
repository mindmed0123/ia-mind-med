import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, FileText, User, AlertTriangle, Pill, Crown, Stethoscope, ClipboardList, FlaskConical, ShieldAlert, Activity, Sparkles, Clock, Brain, CheckCircle, BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useAppState } from "@/hooks/useAppState";
import { buildCleanLaudoText } from "@/lib/laudo-clean-text";

interface LaudoSectionConfig {
  key: string;
  label: string;
  enabled: boolean;
}

interface LaudoViewerProps {
  laudoId: string;
  refreshKey?: number;
  visibleSections?: LaudoSectionConfig[];
  laudoData?: any;
}

/* ── Visual Vital Signs Grid ── */
const VITAL_CONFIG: Record<string, { label: string; unit: string }> = {
  PA:       { label: 'PA',      unit: 'mmHg' },
  FC:       { label: 'FC',      unit: 'bpm'  },
  FR:       { label: 'FR',      unit: 'irpm' },
  SpO2:     { label: 'SpO₂',   unit: '%'    },
  Temp:     { label: 'Temp',    unit: '°C'   },
  Glicemia: { label: 'Glicemia',unit: 'mg/dL'},
  Peso:     { label: 'Peso',    unit: 'kg'   },
  Altura:   { label: 'Altura',  unit: 'm'    },
  IMC:      { label: 'IMC',     unit: 'kg/m²'},
  FC_ritmo: { label: 'Ritmo',   unit: ''     },
};

const VitalsGrid = ({ vitals, sinaisVitaisTexto }: { vitals?: any; sinaisVitaisTexto?: string }) => {
  const items: { label: string; value: string; unit: string }[] = [];

  if (vitals) {
    Object.entries(VITAL_CONFIG).forEach(([key, cfg]) => {
      const val = vitals[key];
      if (val != null && String(val).trim() !== '') {
        items.push({ label: cfg.label, value: String(val), unit: cfg.unit });
      }
    });
  }

  if (items.length === 0 && sinaisVitaisTexto) {
    return (
      <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
        <p className="text-sm font-medium text-foreground leading-relaxed">{sinaisVitaisTexto}</p>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 mt-1">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col items-center justify-center rounded-xl bg-primary/8 border border-primary/20 px-3 py-3 text-center min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-1 truncate w-full text-center">{item.label}</span>
          <span className="text-base font-bold text-foreground leading-none">{item.value}</span>
          {item.unit && <span className="text-[10px] text-muted-foreground mt-0.5">{item.unit}</span>}
        </div>
      ))}
    </div>
  );
};

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

/* ── Premium Clean Clinical Laudo (copy-friendly) ── */
const ClinicalSection = ({
  title,
  children,
  number,
}: {
  title: string;
  children: React.ReactNode;
  number?: number;
}) => (
  <section className="border-b border-border/40 pb-5 last:border-0 last:pb-0">
    <div className="flex items-baseline gap-2 mb-2.5">
      {number !== undefined && (
        <span className="text-[11px] font-bold text-primary/60 tabular-nums">
          {String(number).padStart(2, "0")}
        </span>
      )}
      <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-foreground">
        {title}
      </h3>
    </div>
    <div className="text-[14.5px] leading-[1.7] text-foreground/90 font-normal whitespace-pre-wrap pl-0">
      {children}
    </div>
  </section>
);

const CleanClinicalLaudo = ({
  laudo,
  onCopy,
}: {
  laudo: any;
  onCopy: (text: string) => void;
}) => {
  const s = laudo.sections || {};
  const h = laudo.hypotheses || {};
  const p = laudo.patient_data || {};

  const cleanText = buildCleanLaudoText({
    patient_data: laudo.patient_data,
    sections: laudo.sections,
    hypotheses: laudo.hypotheses,
    cid10_codes: laudo.cid10_codes,
    conducts: laudo.conducts,
    complementary_exams: laudo.complementary_exams,
    red_flags: laudo.red_flags,
    diagnosis_main: laudo.diagnosis_main,
    diagnosis_diff: laudo.diagnosis_diff,
    summary: laudo.summary,
    created_at: laudo.created_at,
    legal_disclaimer: laudo.legal_disclaimer,
  });

  const principal = s.hipoteses?.principal || h.mais_provavel?.descricao || laudo.diagnosis_main;
  const diferencial = s.hipoteses?.diferencial || h.menos_provavel?.descricao || laudo.diagnosis_diff;
  const hda = s.hda || laudo.summary?.resumo_clinico;
  const conduta = s.conduta || (laudo.conducts && laudo.conducts.length > 0
    ? (laudo.conducts as any[]).map((c, i) => `${i + 1}. ${typeof c === "string" ? c : JSON.stringify(c)}`).join("\n")
    : "");
  const examesComplementares = s.exames_complementares || (laudo.complementary_exams && laudo.complementary_exams.length > 0
    ? (laudo.complementary_exams as any[]).map((e, i) => `${i + 1}. ${typeof e === "string" ? e : JSON.stringify(e)}`).join("\n")
    : "");

  let n = 0;
  const next = () => ++n;

  return (
    <div className="relative">
      {/* Sticky copy bar */}
      <div className="sticky top-0 z-20 -mx-1 mb-4 flex items-center justify-between rounded-xl border border-border/60 bg-background/95 backdrop-blur-md px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Laudo Clínico</span>
          <Badge variant="outline" className="text-[10px] gap-1 ml-1">
            <Sparkles className="w-2.5 h-2.5" /> Pronto para Ctrl+C / Ctrl+V
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => onCopy(cleanText)}
          className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90"
        >
          <Copy className="w-3.5 h-3.5" /> Copiar Laudo
        </Button>
      </div>

      {/* Document body */}
      <article className="bg-card border border-border/60 rounded-2xl shadow-sm px-7 sm:px-10 py-8 max-w-[78ch] mx-auto">
        {/* Title */}
        <header className="text-center pb-5 mb-6 border-b-2 border-primary/20">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            LAUDO CLÍNICO
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(laudo.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </header>

        <div className="space-y-6">
          {/* Patient block */}
          <ClinicalSection title="Dados do Paciente">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
              <div><span className="font-semibold">Paciente:</span> {p.nome_completo || p.iniciais || "—"}</div>
              {p.idade && <div><span className="font-semibold">Idade:</span> {p.idade}{typeof p.idade === "number" ? " anos" : ""}</div>}
              {p.sexo && <div><span className="font-semibold">Sexo:</span> {p.sexo === "M" ? "Masculino" : p.sexo === "F" ? "Feminino" : p.sexo}</div>}
              {p.queixa_principal && <div className="sm:col-span-2"><span className="font-semibold">Queixa principal:</span> {p.queixa_principal}</div>}
            </div>
          </ClinicalSection>

          {(s.queixa || hda || s.isda || s.sinais_vitais_texto || s.medicacoes_em_uso || s.habitos_de_vida || s.antecedentes_pessoais || s.antecedentes_familiares) && (
            <ClinicalSection title="Anamnese" number={next()}>
              {s.queixa && <p className="mb-2"><strong>Queixa principal:</strong> {s.queixa}</p>}
              {hda && <p className="mb-2 whitespace-pre-wrap"><strong>História da doença atual:</strong> {hda}</p>}
              {s.isda && <p className="mb-2 whitespace-pre-wrap"><strong>Interrogatório sistemático:</strong> {s.isda}</p>}
              {s.antecedentes_pessoais && <p className="mb-2 whitespace-pre-wrap"><strong>Antecedentes pessoais:</strong> {s.antecedentes_pessoais}</p>}
              {s.antecedentes_familiares && <p className="mb-2 whitespace-pre-wrap"><strong>Antecedentes familiares:</strong> {s.antecedentes_familiares}</p>}
              {s.habitos_de_vida && <p className="mb-2 whitespace-pre-wrap"><strong>Hábitos de vida:</strong> {s.habitos_de_vida}</p>}
              {s.medicacoes_em_uso && <p className="mb-2 whitespace-pre-wrap"><strong>Medicações em uso:</strong> {s.medicacoes_em_uso}</p>}
              {s.sinais_vitais_texto && <p className="mb-0"><strong>Sinais vitais:</strong> {s.sinais_vitais_texto}</p>}
            </ClinicalSection>
          )}

          {(s.historico && s.historico !== s.antecedentes_pessoais) && (
            <ClinicalSection title="Histórico Médico" number={next()}>
              {s.historico}
            </ClinicalSection>
          )}

          {s.exame_fisico && (
            <ClinicalSection title="Exame Físico" number={next()}>
              <p className="whitespace-pre-wrap">{s.exame_fisico}</p>
            </ClinicalSection>
          )}

          {(principal || diferencial) && (
            <ClinicalSection title="Hipóteses Diagnósticas" number={next()}>
              {principal && (
                <p className="mb-2">
                  <strong>1. Hipótese mais provável:</strong> {principal}
                </p>
              )}
              {diferencial && (
                <p>
                  <strong>2. Diagnóstico diferencial:</strong> {diferencial}
                </p>
              )}
            </ClinicalSection>
          )}

          {laudo.cid10_codes && laudo.cid10_codes.length > 0 && (
            <ClinicalSection title="CID-10" number={next()}>
              <div className="flex flex-wrap gap-2">
                {laudo.cid10_codes.map((c: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[13px] font-semibold"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </ClinicalSection>
          )}

          {conduta && (
            <ClinicalSection title="Conduta" number={next()}>
              {conduta}
            </ClinicalSection>
          )}

          {examesComplementares && (
            <ClinicalSection title="Exames Complementares" number={next()}>
              {examesComplementares}
            </ClinicalSection>
          )}

          {laudo.red_flags && laudo.red_flags.length > 0 && (
            <ClinicalSection title="Sinais de Alerta / Red Flags" number={next()}>
              <ul className="space-y-1.5 list-none pl-0">
                {laudo.red_flags.map((f: any, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <span>{typeof f === "string" ? f : f?.text || f?.description}</span>
                  </li>
                ))}
              </ul>
            </ClinicalSection>
          )}

          {(s.orientacoes || s.orientacoes_paciente) && (
            <ClinicalSection title="Orientações ao Paciente" number={next()}>
              {s.orientacoes || s.orientacoes_paciente}
            </ClinicalSection>
          )}

          {(s.observacoes || s.observacoes_medicas || s.descricao_manual_exames) && (
            <ClinicalSection title="Observações Médicas Adicionais" number={next()}>
              {s.observacoes || s.observacoes_medicas || s.descricao_manual_exames}
            </ClinicalSection>
          )}
        </div>

        {laudo.legal_disclaimer && (
          <footer className="mt-8 pt-5 border-t border-border/40">
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              {laudo.legal_disclaimer}
            </p>
          </footer>
        )}
      </article>

      {/* Bottom copy button (always reachable) */}
      <div className="flex justify-center mt-5">
        <Button
          size="lg"
          onClick={() => onCopy(cleanText)}
          className="gap-2 px-6 bg-primary hover:bg-primary/90"
        >
          <Copy className="w-4 h-4" /> Copiar Laudo Completo
        </Button>
      </div>
    </div>
  );
};

export const LaudoViewer = ({ laudoId, refreshKey, visibleSections, laudoData }: LaudoViewerProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscription } = useAppState();
  const [laudo, setLaudo] = useState<any>(laudoData || null);
  const [loading, setLoading] = useState(!laudoData);
  const [generatingScience, setGeneratingScience] = useState(false);

  const handleGenerateScientificBasis = async () => {
    if (!subscription?.isPro) {
      navigate('/precos');
      return;
    }
    setGeneratingScience(true);
    try {
      toast({ title: "Buscando evidências…", description: "Consultando PubMed e gerando embasamento." });
      const { data, error } = await supabase.functions.invoke('generate-scientific-basis', {
        body: { laudo_id: laudoId },
      });
      if (error) throw error;
      if (data?.scientific_basis) {
        setLaudo((prev: any) => ({ ...prev, scientific_basis: data.scientific_basis }));
        toast({ title: "Embasamento científico pronto!", description: `${data.scientific_basis.articles?.length || 0} artigos referenciados.` });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Não foi possível gerar o embasamento.", variant: "destructive" });
    } finally {
      setGeneratingScience(false);
    }
  };

  // If parent passes laudoData, use it directly (no DB fetch needed)
  useEffect(() => {
    if (laudoData) {
      setLaudo(laudoData);
      setLoading(false);
      return;
    }
    loadLaudo();
  }, [laudoId, refreshKey, laudoData]);

  const loadLaudo = async () => {
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
      <Tabs defaultValue="clinico" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="clinico" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ClipboardList className="w-4 h-4" /> Laudo Clínico
          </TabsTrigger>
          <TabsTrigger value="resumo" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Brain className="w-4 h-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger value="laudo" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4" /> Markdown
          </TabsTrigger>
          <TabsTrigger value="paciente" className="rounded-lg text-sm font-medium gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <User className="w-4 h-4" /> Paciente
          </TabsTrigger>
        </TabsList>

        {/* ══════ TAB: LAUDO CLÍNICO (copy-friendly premium view) ══════ */}
        <TabsContent value="clinico" className="mt-5">
          <CleanClinicalLaudo laudo={laudo} onCopy={copyToClipboard} />
        </TabsContent>


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
          {isSectionVisible('anamnese') && (sections.queixa || sections.hda || sections.isda || sections.sinais_vitais_texto || sections.medicacoes_em_uso || sections.habitos_de_vida || sections.antecedentes_pessoais || sections.antecedentes_familiares || laudo.summary?.resumo_clinico) && (
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
                {sections.isda && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Interrogatório Sistemático</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.isda}</p>
                  </div>
                )}
                {sections.antecedentes_pessoais && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Antecedentes Pessoais</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.antecedentes_pessoais}</p>
                  </div>
                )}
                {sections.antecedentes_familiares && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Antecedentes Familiares</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.antecedentes_familiares}</p>
                  </div>
                )}
                {sections.habitos_de_vida && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Hábitos de Vida</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.habitos_de_vida}</p>
                  </div>
                )}
                {sections.medicacoes_em_uso && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Medicações em Uso</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.medicacoes_em_uso}</p>
                  </div>
                )}
                {sections.sinais_vitais_texto && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Sinais Vitais</h4>
                    <p className="text-sm font-medium text-foreground leading-relaxed">{sections.sinais_vitais_texto}</p>
                  </div>
                )}
                {sections.exame_fisico && (
                  <div>
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Exame Físico</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{sections.exame_fisico}</p>
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

          {/* Embasamento Científico (PRO, RAG PubMed) */}
          {isSectionVisible('scientific_basis') !== false && (
            <SectionBlock icon={BookOpen} title="Embasamento Científico" variant="highlight" delay={450}>
              {laudo.scientific_basis ? (
                <div className="space-y-4">
                  {laudo.scientific_basis.summary && (
                    <div>
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Resumo das evidências</h4>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{laudo.scientific_basis.summary}</p>
                    </div>
                  )}
                  {laudo.scientific_basis.justification && (
                    <div>
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Justificativa médica</h4>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{laudo.scientific_basis.justification}</p>
                    </div>
                  )}
                  {Array.isArray(laudo.scientific_basis.guidelines) && laudo.scientific_basis.guidelines.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Diretrizes citadas</h4>
                      <ul className="space-y-1.5">
                        {laudo.scientific_basis.guidelines.map((g: any, idx: number) => (
                          <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>
                              <span className="font-medium">{g.name}</span>
                              {g.source ? <span className="text-muted-foreground"> — {g.source}</span> : null}
                              {g.url ? (
                                <a href={g.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline inline-flex items-center gap-1">
                                  link <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(laudo.scientific_basis.articles) && laudo.scientific_basis.articles.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                        Artigos PubMed ({laudo.scientific_basis.articles.length})
                      </h4>
                      <ol className="space-y-3">
                        {laudo.scientific_basis.articles.map((a: any, idx: number) => (
                          <li key={a.pmid} className="text-sm border-l-2 border-primary/30 pl-3">
                            <div className="flex items-baseline gap-1">
                              <span className="font-semibold text-muted-foreground">[{idx + 1}]</span>
                              <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-primary inline-flex items-baseline gap-1">
                                {a.title}
                                <ExternalLink className="w-3 h-3 inline-block opacity-60" />
                              </a>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {(a.authors || []).slice(0, 3).join(', ')}{(a.authors?.length || 0) > 3 ? ' et al.' : ''}
                              {a.journal ? ` · ${a.journal}` : ''}
                              {a.year ? ` · ${a.year}` : ''}
                              <span className="ml-1 font-mono">PMID:{a.pmid}</span>
                            </div>
                            {a.relevance && (
                              <p className="text-xs text-foreground/80 italic mt-1">{a.relevance}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">
                      Gerado em {new Date(laudo.scientific_basis.generated_at).toLocaleString('pt-BR')}
                    </span>
                    <Button size="sm" variant="ghost" onClick={handleGenerateScientificBasis} disabled={generatingScience} className="h-7 text-xs gap-1.5">
                      {generatingScience ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Atualizar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Gere um embasamento científico baseado em PubMed para este laudo.<br />
                    O MindMed buscará artigos atuais e construirá a justificativa médica com citações.
                  </p>
                  <Button onClick={handleGenerateScientificBasis} disabled={generatingScience} size="sm" className="gap-1.5">
                    {generatingScience ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando evidências…</>
                    ) : subscription?.isPro ? (
                      <><BookOpen className="w-3.5 h-3.5" /> Gerar Embasamento Científico</>
                    ) : (
                      <><Crown className="w-3.5 h-3.5" /> Recurso PRO</>
                    )}
                  </Button>
                </div>
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
              {isSectionVisible('disclaimer') && laudo.legal_disclaimer && (
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
