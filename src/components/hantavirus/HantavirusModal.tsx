import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Camera, X, AlertTriangle, ShieldAlert, Loader2, ArrowLeft, ArrowRight,
  CheckCircle2, FileText, Save, RefreshCw, Download,
} from "lucide-react";
import {
  SINTOMAS_LABELS, FATORES_LABELS,
  SintomasHantavirus, FatoresEpidemiologicos,
} from "@/types/hantavirus";
import { useHantavirusTriagem } from "@/hooks/useHantavirusTriagem";
import { ProbabilityGauge } from "./ProbabilityGauge";
import { VoiceRecorder } from "./VoiceRecorder";
import { useToast } from "@/hooks/use-toast";
import { maskCpf, isValidCpf, unmaskCpf } from "@/lib/cpf";
import { gerarLaudoHantavirusPdf } from "@/lib/gerarLaudoHantavirusPdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SINTOMAS_GERAIS: (keyof SintomasHantavirus)[] = [
  "febre", "cefaleia", "mialgia", "dor_lombar",
  "dor_abdominal", "nausea", "vomito", "diarreia", "fadiga",
];
const SINTOMAS_CUTANEOS: (keyof SintomasHantavirus)[] = [
  "rubor_facial", "olhos_vermelhos", "petequias",
];
const SINTOMAS_GRAVES: (keyof SintomasHantavirus)[] = [
  "tosse_seca", "dispneia", "hipotensao", "taquicardia",
];

const LOADING_MSGS = [
  "Analisando sintomas clínicos...",
  "Processando imagens das lesões...",
  "Calculando probabilidade...",
  "Consultando base de dados epidemiológicos...",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function HantavirusModal({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const t = useHantavirusTriagem();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const nomeCompletoOk = t.patientName.trim().split(/\s+/).length >= 2;
  const cpfOk = isValidCpf(unmaskCpf(t.patientCpf));

  const handleDownloadLaudo = async () => {
    if (!t.resultado || !user) return;
    setDownloadingPdf(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, crm, crm_uf, specialty, clinic_name")
        .eq("id", user.id)
        .maybeSingle();
      await gerarLaudoHantavirusPdf(t.resultado as any, (profile || {}) as any);
      toast({ title: "Laudo gerado", description: "PDF baixado com sucesso." });
    } catch (err) {
      toast({
        title: "Erro ao gerar PDF",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };


  useEffect(() => {
    if (!open) { setStep(1); t.resetar(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!t.isAnalyzing) return;
    const id = setInterval(
      () => setLoadingIdx((i) => (i + 1) % LOADING_MSGS.length), 2000
    );
    return () => clearInterval(id);
  }, [t.isAnalyzing]);

  useEffect(() => {
    if (t.resultado) setStep(3);
  }, [t.resultado]);

  const sintomasCount = Object.values(t.sintomas).filter(Boolean).length;

  const handleImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024);
    t.setImagens([...t.imagens, ...valid].slice(0, 4));
  };

  const goAnalisar = async () => {
    await t.analisar();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="text-2xl">🦠</span> Triagem — Hantavírus
              </DialogTitle>
              <DialogDescription>
                Auxílio diagnóstico por IA · Não substitui avaliação clínica
              </DialogDescription>
            </div>
            <Badge className="bg-red-600 hover:bg-red-600 text-white animate-pulse">
              🔴 Surto Ativo 2026
            </Badge>
          </div>
          <Progress value={(step / 3) * 100} className="h-1.5 mt-2" />
          <div className="text-xs text-muted-foreground">Etapa {step} de 3</div>
        </DialogHeader>

        {/* ETAPA 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Identificação do Paciente <span className="text-red-600">*</span>
                </h3>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Obrigatório para vincular ao prontuário e gerar o laudo final.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="pname">Nome completo *</Label>
                  <Input
                    id="pname"
                    value={t.patientName}
                    onChange={(e) => t.setPatientName(e.target.value)}
                    placeholder="Ex: Maria Silva Santos"
                  />
                  {t.patientName.trim() && !nomeCompletoOk && (
                    <p className="text-[11px] text-red-600">Informe nome e sobrenome.</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pcpf">CPF *</Label>
                  <Input
                    id="pcpf"
                    inputMode="numeric"
                    value={t.patientCpf}
                    onChange={(e) => t.setPatientCpf(maskCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  {t.patientCpf && !cpfOk && (
                    <p className="text-[11px] text-red-600">CPF inválido.</p>
                  )}
                  {cpfOk && (
                    <p className="text-[11px] text-emerald-600">✓ CPF válido — paciente será criado/vinculado automaticamente.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Sintomas</h3>
                  <Badge variant="outline">{sintomasCount} selecionado(s)</Badge>
                </div>

                <div>
                  <p className="text-xs font-medium mb-2 text-muted-foreground">
                    Fase Prodrômica
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SINTOMAS_GERAIS.map((k) => (
                      <CheckboxRow
                        key={k} label={SINTOMAS_LABELS[k]}
                        checked={t.sintomas[k]} onChange={() => t.toggleSintoma(k)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-medium mb-2 text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Manifestações Cutâneas e Visuais
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SINTOMAS_CUTANEOS.map((k) => (
                      <CheckboxRow
                        key={k} label={SINTOMAS_LABELS[k]}
                        checked={t.sintomas[k]} onChange={() => t.toggleSintoma(k)}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-700 mt-2">
                    ⚠️ Manifestações cutâneas aumentam significativamente a suspeita
                  </p>
                </div>

                <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                  <p className="text-xs font-medium mb-2 text-red-800 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Fase Cardiopulmonar (graves)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SINTOMAS_GRAVES.map((k) => (
                      <CheckboxRow
                        key={k} label={SINTOMAS_LABELS[k]}
                        checked={t.sintomas[k]} onChange={() => t.toggleSintoma(k)}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-red-700 mt-2">
                    🚨 Sintomas respiratórios + fase prodrômica = emergência
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-3">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Fatores Epidemiológicos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(FATORES_LABELS) as (keyof FatoresEpidemiologicos)[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => t.toggleFator(k)}
                      className={`text-left rounded-lg border p-3 text-sm transition ${
                        t.fatores[k]
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {t.fatores[k] ? "✅" : "⬜"} {FATORES_LABELS[k]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!nomeCompletoOk || !cpfOk}>
                Próxima etapa <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-5 space-y-3">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Fotos das lesões cutâneas
                </h3>
                <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40 transition">
                  <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Fotografe as manchas ou lesões</p>
                  <p className="text-xs text-muted-foreground">
                    Petéquias, rubor, lesões — até 4 imagens, 10MB cada
                  </p>
                  <input
                    type="file" accept="image/*" multiple capture="environment"
                    className="hidden" onChange={handleImagem}
                  />
                </label>

                {t.imagens.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {t.imagens.map((f, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => t.setImagens(t.imagens.filter((_, x) => x !== i))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Imagens armazenadas com segurança em ambiente criptografado. LGPD — Art. 11.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                    Descrição clínica (opcional)
                  </h3>
                  <VoiceRecorder
                    transcribe={t.transcreverAudio}
                    onTranscription={(text) =>
                      t.setDescricaoSintomas(
                        (prev) => (prev ? prev + " " : "") + text as any
                      )
                    }
                  />
                </div>
                <Textarea
                  rows={5}
                  value={t.descricaoSintomas}
                  onChange={(e) => t.setDescricaoSintomas(e.target.value)}
                  placeholder="Ex: Paciente refere febre há 3 dias, dor muscular intensa, trabalha em fazenda e relatou contato com roedores há 5 dias..."
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {t.descricaoSintomas.length} caracteres
                </p>
              </CardContent>
            </Card>

            {t.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {t.error}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={t.isAnalyzing}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <Button
                onClick={goAnalisar}
                disabled={t.isAnalyzing}
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-90"
              >
                {t.isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {LOADING_MSGS[loadingIdx]}
                  </>
                ) : (
                  <>Analisar com IA <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 3 */}
        {step === 3 && t.resultado && (
          <div className="space-y-5">
            <Card className={`border-2 ${
              t.resultado.classificacao_risco === "critico" ? "border-red-600" :
              t.resultado.classificacao_risco === "alto" ? "border-red-400" :
              t.resultado.classificacao_risco === "moderado" ? "border-amber-400" :
              "border-emerald-400"
            }`}>
              <CardContent className="pt-6 flex flex-col items-center">
                <ProbabilityGauge
                  value={t.resultado.probabilidade_hantavirus ?? 0}
                  risco={t.resultado.classificacao_risco ?? "baixo"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Análise Clínica
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    Gerado por GPT-4o · Auxílio diagnóstico
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {t.resultado.analise_ia}
                </p>
              </CardContent>
            </Card>

            {t.resultado.imagens_manchas?.length > 0 && (
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <h4 className="font-semibold">Análise das Imagens</h4>
                  <p className="text-sm whitespace-pre-wrap">{t.resultado.analise_imagem_ia}</p>
                  <div className="flex gap-2 flex-wrap">
                    {t.resultado.imagens_manchas.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded border" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!!t.resultado.recomendacoes_ia?.length && (
              <Card>
                <CardContent className="pt-5 space-y-2">
                  <h4 className="font-semibold">Recomendações Clínicas</h4>
                  <ol className="space-y-2">
                    {t.resultado.recomendacoes_ia.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {!!t.resultado.diferenciais_ia?.length && (
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <h4 className="font-semibold">Diagnósticos Diferenciais</h4>
                  <div className="flex gap-2 flex-wrap">
                    {t.resultado.diferenciais_ia.map((d, i) => (
                      <Badge key={i} variant="secondary">{d}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(t.resultado.classificacao_risco === "alto" ||
              t.resultado.classificacao_risco === "critico") && (
              <Card className="border-2 border-red-500 bg-red-50 animate-pulse-soft">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-bold">
                    🚨 NOTIFICAÇÃO COMPULSÓRIA
                  </div>
                  <p className="text-sm text-red-800">
                    Casos suspeitos de Hantavirose são de notificação compulsória
                    (Portaria GM/MS nº 4/2017). Notifique a Vigilância Epidemiológica do seu município.
                  </p>
                  <a
                    href="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/h/hantavirose"
                    target="_blank" rel="noreferrer"
                    className="inline-block text-sm text-red-700 underline"
                  >
                    📋 Ficha de Notificação SINAN
                  </a>
                </CardContent>
              </Card>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              ⚕️ Auxílio diagnóstico gerado por IA. Não substitui avaliação clínica do médico.
            </p>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => { t.resetar(); setStep(1); }}>
                <RefreshCw className="w-4 h-4 mr-2" /> Nova Triagem
              </Button>
              <Button
                onClick={async () => {
                  await t.salvarProntuario();
                  toast({ title: "Salvo no prontuário do paciente" });
                }}
                disabled={t.resultado.status === "salvo_prontuario"}
              >
                <Save className="w-4 h-4 mr-2" />
                {t.resultado.status === "salvo_prontuario" ? "Salvo" : "Salvar no Prontuário"}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckboxRow({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-muted/40">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
