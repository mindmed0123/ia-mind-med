import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save, Sparkles, Pill, Loader2, CheckCircle2, FileText, AlertTriangle, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText, validatePatientName, validateMedicationName, validateDosage } from '@/lib/validation';
import { MedicationSearch, type MedicationResult } from '@/components/prescription/MedicationSearch';
import {
  inferTipoReceita,
  groupByReceita,
  isControlado,
  TIPO_RECEITA_LABEL,
  TIPO_RECEITA_SHORT,
  TIPO_RECEITA_COLOR,
  type TipoReceita,
} from '@/lib/receita-classifier';

interface PrescriptionItem {
  medicamento: string;
  dosagem: string;
  posologia: string;
  duracao: string;
  observacoes?: string;
  parceiro?: string | null;
  tarja?: string | null;
  tipo_receita?: string | null;
  principio_ativo?: string | null;
  origem?: 'mencionada' | 'sugerida_ia' | string | null;
  medication_id?: string | null;
  is_parceiro?: boolean;
  parceiro_nome?: string | null;
  sugestao_parceiro?: string | null;
  nao_catalogado?: boolean;
  confirmado_fora_catalogo?: boolean;
}

interface PrescriptionTabProps {
  laudoData: any;
  patientData: any;
}

const stripDose = (s: string) =>
  String(s || '')
    .replace(/\d+([\.,]\d+)?\s*(mg|mcg|g|ml|ui|%|cp|comp|caps|gts|gotas)\b/gi, ' ')
    .replace(/[\/\+].*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function PrescriptionTab({ laudoData, patientData }: PrescriptionTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [notes, setNotes] = useState('');
  const [hasExtractedMeds, setHasExtractedMeds] = useState(false);

  // Fallback: resolve item contra catálogo (usado para laudos ANTIGOS sem metadados)
  const resolveAgainstCatalog = async (item: PrescriptionItem): Promise<PrescriptionItem> => {
    if (item.medication_id || item.nao_catalogado) return item;
    const q = stripDose(item.medicamento) || item.medicamento;
    if (!q) return item;
    try {
      const { data } = await supabase.rpc('search_medications', { q, cid: null });
      const arr = Array.isArray(data) ? data : [];
      if (arr.length === 0) return { ...item, nao_catalogado: true };
      const top = arr[0] as any;
      return {
        ...item,
        medication_id: top.id,
        principio_ativo: top.principio_ativo,
        tarja: top.tarja,
        tipo_receita: top.tipo_receita,
        is_parceiro: !!top.is_parceiro,
        parceiro: top.parceiro_nome || item.parceiro || null,
        parceiro_nome: top.parceiro_nome || null,
      };
    } catch {
      return { ...item, nao_catalogado: true };
    }
  };

  useEffect(() => {
    const sections = laudoData?.sections as any;
    const prescricoes = sections?.prescricoes_sugeridas;

    if (Array.isArray(prescricoes) && prescricoes.length > 0) {
      const mapped: PrescriptionItem[] = prescricoes.map((p: any) => ({
        medicamento: p.medicamento || '',
        dosagem: p.dosagem || '',
        posologia: p.posologia || '',
        duracao: p.duracao || '',
        observacoes: p.observacoes || '',
        origem: p.origem || null,
        medication_id: p.medication_id ?? null,
        principio_ativo: p.principio_ativo ?? null,
        tarja: p.tarja ?? null,
        tipo_receita: p.tipo_receita ?? null,
        is_parceiro: !!p.is_parceiro,
        parceiro: p.parceiro_nome || p.parceiro || null,
        parceiro_nome: p.parceiro_nome ?? null,
        sugestao_parceiro: p.sugestao_parceiro ?? null,
        nao_catalogado: !!p.nao_catalogado,
      }));
      setItems(mapped);
      setHasExtractedMeds(true);

      // Fallback para laudos antigos: itens sem medication_id nem flag nao_catalogado
      const precisaResolver = mapped.some((m) => !m.medication_id && !m.nao_catalogado);
      if (precisaResolver) {
        (async () => {
          const resolved = await Promise.all(mapped.map(resolveAgainstCatalog));
          setItems(resolved);
        })();
      }
    } else {
      setItems([{ medicamento: '', dosagem: '', posologia: '', duracao: '', observacoes: '' }]);
      setHasExtractedMeds(false);
    }


    // Build notes from diagnosis
    const diagParts: string[] = [];
    if (laudoData?.diagnosis_main) diagParts.push(`Diagnóstico: ${laudoData.diagnosis_main}`);
    const conducts = laudoData?.conducts;
    if (Array.isArray(conducts) && conducts.length > 0) {
      diagParts.push(`Conduta: ${conducts.join('; ')}`);
    }
    const cid10 = laudoData?.cid10_codes;
    if (Array.isArray(cid10) && cid10.length > 0) {
      diagParts.push(`CID-10: ${cid10.join(', ')}`);
    }
    if (diagParts.length > 0) setNotes(diagParts.join('\n\n'));
  }, [laudoData]);

  const handleAddItem = () => {
    setItems([...items, { medicamento: '', dosagem: '', posologia: '', duracao: '', observacoes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PrescriptionItem, value: string) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    // Se o médico editou o nome manualmente, invalida a resolução prévia
    if (field === 'medicamento') {
      newItems[index].medication_id = null;
      newItems[index].nao_catalogado = false;
      newItems[index].confirmado_fora_catalogo = false;
      newItems[index].sugestao_parceiro = null;
    }
    setItems(newItems);
  };

  const handleMedicationSelect = (index: number, med: MedicationResult) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      medicamento: med.nome_comercial,
      dosagem: med.concentracao || newItems[index].dosagem,
      posologia: med.posologia_referencia || newItems[index].posologia,
      parceiro: med.parceiro_nome,
      parceiro_nome: med.parceiro_nome,
      tarja: med.tarja,
      tipo_receita: med.tipo_receita,
      principio_ativo: (med as any).principio_ativo || newItems[index].principio_ativo,
      medication_id: (med as any).id || null,
      is_parceiro: !!(med as any).is_parceiro,
      nao_catalogado: false,
      confirmado_fora_catalogo: false,
      sugestao_parceiro: null,
    };
    setItems(newItems);
  };

  const handleToggleConfirmacao = (index: number, checked: boolean) => {
    const newItems = [...items];
    newItems[index].confirmado_fora_catalogo = checked;
    setItems(newItems);
  };

  const validItemsForPreview = items.filter(i => i.medicamento.trim());
  const receitaGroups = groupByReceita(validItemsForPreview);
  const hasControlados = receitaGroups.some(g => isControlado(g.tipo));
  // Bloqueia salvamento se houver item fora do catálogo sem confirmação explícita
  const pendenteConfirmacao = validItemsForPreview.some(
    (i) => i.nao_catalogado && !i.confirmado_fora_catalogo
  );


  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const patientName = patientData?.iniciais || patientData?.name || 'Paciente';
      
      if (!validatePatientName(patientName) && patientName.length < 2) {
        throw new Error('Nome do paciente inválido');
      }

      const validItems = items.filter(item =>
        item.medicamento.trim() && item.dosagem.trim() && item.posologia.trim()
      );

      if (validItems.length === 0) {
        throw new Error('Adicione pelo menos um medicamento com nome, dosagem e posologia');
      }

      // Exige confirmação para itens fora do catálogo antes de gravar
      const semConfirmacao = validItems.filter(
        (i) => i.nao_catalogado && !i.confirmado_fora_catalogo
      );
      if (semConfirmacao.length > 0) {
        throw new Error(
          `Confirme os medicamentos fora do catálogo antes de salvar: ${semConfirmacao
            .map((i) => i.medicamento)
            .join(', ')}`,
        );
      }

      for (const item of validItems) {
        if (!validateMedicationName(item.medicamento)) {
          throw new Error(`Medicamento "${item.medicamento}" inválido`);
        }
        if (!validateDosage(item.dosagem)) {
          throw new Error(`Dosagem "${item.dosagem}" inválida`);
        }
      }

      const prescriptionData: any = {
        user_id: user.id,
        patient_name: sanitizeText(patientName),
        patient_sex: patientData?.sexo || null,
        laudo_id: laudoData?.id || null,
        ai_generated: true,
        status: 'final',
        items: validItems.map(item => ({
          medicamento: sanitizeText(item.medicamento),
          dosagem: sanitizeText(item.dosagem),
          posologia: sanitizeText(item.posologia),
          duracao: item.duracao ? sanitizeText(item.duracao) : '',
          observacoes: item.observacoes ? sanitizeText(item.observacoes) : '',
          parceiro: item.parceiro || null,
          parceiro_nome: item.parceiro_nome || null,
          tarja: item.tarja || null,
          tipo_receita: inferTipoReceita(item),
          principio_ativo: item.principio_ativo || null,
          medication_id: item.medication_id || null,
          is_parceiro: !!item.is_parceiro,
          nao_catalogado: !!item.nao_catalogado,
          confirmado_fora_catalogo: !!item.confirmado_fora_catalogo,
          origem: item.origem || null,
        })) as any,
        notes: notes ? sanitizeText(notes) : null,
        tipo_receita: (() => {
          const order: TipoReceita[] = ['amarela_a', 'azul_b', 'controle_especial', 'antimicrobiano', 'branca_comum'];
          for (const t of order) {
            if (validItems.some(i => inferTipoReceita(i) === t)) return t;
          }
          return 'branca_comum';
        })(),
      };

      // Se já existe prescription atrelada a este laudo (rascunho IA), faz UPDATE.
      let existingId: string | null = null;
      if (laudoData?.id) {
        const { data: existing } = await supabase
          .from('prescriptions')
          .select('id')
          .eq('laudo_id', laudoData.id)
          .maybeSingle();
        existingId = existing?.id || null;
      }

      const { error } = existingId
        ? await supabase.from('prescriptions').update(prescriptionData).eq('id', existingId)
        : await supabase.from('prescriptions').insert(prescriptionData);

      if (error) throw error;

      toast({ title: 'Receituário salvo!', description: existingId ? 'Rascunho revisado e finalizado.' : 'O receituário foi criado com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              Receituário
            </CardTitle>
            <CardDescription className="mt-1">
              {hasExtractedMeds ? (
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  Medicamentos extraídos automaticamente da consulta — revise antes de salvar
                </span>
              ) : (
                'Nenhum medicamento identificado na consulta. Preencha manualmente.'
              )}
            </CardDescription>
          </div>
          {hasExtractedMeds && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              IA
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Medication items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Medicamentos</h3>
            <Button variant="outline" size="sm" onClick={handleAddItem}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {items.map((item, index) => (
            <Card
              key={index}
              className="p-4 border border-border/70 bg-gradient-to-br from-card to-card/60 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                    <Pill className="w-4 h-4 text-primary" />
                    Medicamento #{index + 1}
                    {item.parceiro && (
                      <Badge
                        variant="secondary"
                        className="bg-gradient-to-r from-primary/15 to-accent/15 text-primary border border-primary/20 gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {item.parceiro}
                      </Badge>
                    )}
                    {item.medicamento && (() => {
                      const tipo = inferTipoReceita(item);
                      return (
                        <Badge variant="outline" className={`text-[10px] font-medium ${TIPO_RECEITA_COLOR[tipo]}`}>
                          {TIPO_RECEITA_SHORT[tipo]}
                        </Badge>
                      );
                    })()}
                    {(item as any).origem === 'sugerida_ia' && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900 border-amber-300 gap-1">
                        <Sparkles className="w-3 h-3" />
                        Sugestão da IA
                      </Badge>
                    )}
                    {item.nao_catalogado && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-900 border-yellow-400 gap-1">
                        <HelpCircle className="w-3 h-3" />
                        Não catalogado — revisar
                      </Badge>
                    )}
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Sugestão de parceiro (sem impor) */}
                {item.sugestao_parceiro && !item.is_parceiro && (
                  <div className="flex items-start gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded p-2">
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Equivalente parceiro disponível:{' '}
                      <strong>{item.sugestao_parceiro}</strong> (mesma substância ativa).
                    </span>
                  </div>
                )}

                {/* Confirmação obrigatória para itens fora do catálogo */}
                {item.nao_catalogado && (
                  <label className="flex items-start gap-2 text-xs bg-yellow-50 border border-yellow-300 rounded p-2 cursor-pointer">
                    <Checkbox
                      checked={!!item.confirmado_fora_catalogo}
                      onCheckedChange={(c) => handleToggleConfirmacao(index, !!c)}
                      className="mt-0.5"
                    />
                    <span className="text-yellow-900">
                      Confirmo que este medicamento está correto mesmo sem correspondência no catálogo.
                      Responsabilidade clínica pela prescrição é integralmente do médico.
                    </span>
                  </label>
                )}



                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Medicamento *</Label>
                    <MedicationSearch
                      value={item.medicamento}
                      onChange={(v) => handleItemChange(index, 'medicamento', v)}
                      onSelect={(med) => handleMedicationSelect(index, med)}
                      cid={Array.isArray(laudoData?.cid10_codes) ? laudoData.cid10_codes[0] : null}
                    />
                  </div>
                  <div>
                    <Label>Dosagem *</Label>
                    <Input
                      value={item.dosagem}
                      onChange={(e) => handleItemChange(index, 'dosagem', e.target.value)}
                      placeholder="Ex: 500mg"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <Label>Posologia *</Label>
                    <Input
                      value={item.posologia}
                      onChange={(e) => handleItemChange(index, 'posologia', e.target.value)}
                      placeholder="Ex: 1 comp a cada 8h"
                    />
                  </div>
                  <div>
                    <Label>Duração</Label>
                    <Input
                      value={item.duracao}
                      onChange={(e) => handleItemChange(index, 'duracao', e.target.value)}
                      placeholder="Ex: 7 dias"
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input
                      value={item.observacoes || ''}
                      onChange={(e) => handleItemChange(index, 'observacoes', e.target.value)}
                      placeholder="Ex: Tomar após refeições"
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>


        {/* Resumo de classificação */}
        {receitaGroups.length > 0 && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="text-sm font-semibold">
                  Serão emitidas {receitaGroups.length} receita{receitaGroups.length > 1 ? 's' : ''} (1 PDF):
                </div>
                <div className="flex flex-wrap gap-2">
                  {receitaGroups.map(g => (
                    <Badge
                      key={g.tipo}
                      variant="outline"
                      className={`${TIPO_RECEITA_COLOR[g.tipo]} font-medium`}
                    >
                      {TIPO_RECEITA_LABEL[g.tipo]} · {g.items.length} item{g.items.length > 1 ? 'ns' : ''}
                    </Badge>
                  ))}
                </div>
                {hasControlados && (
                  <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Medicamentos controlados serão emitidos em 2 vias (Farmácia + Paciente) no PDF.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <div>
          <Label>Notas / Contexto Clínico</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notas adicionais para o receituário..."
            className="mt-1"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Receituário
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
