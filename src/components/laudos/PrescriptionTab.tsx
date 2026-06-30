import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Sparkles, Pill, Loader2, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
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
}

interface PrescriptionTabProps {
  laudoData: any;
  patientData: any;
}

export function PrescriptionTab({ laudoData, patientData }: PrescriptionTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [notes, setNotes] = useState('');
  const [hasExtractedMeds, setHasExtractedMeds] = useState(false);

  useEffect(() => {
    const sections = laudoData?.sections as any;
    const prescricoes = sections?.prescricoes_sugeridas;

    if (Array.isArray(prescricoes) && prescricoes.length > 0) {
      setItems(prescricoes.map((p: any) => ({
        medicamento: p.medicamento || '',
        dosagem: p.dosagem || '',
        posologia: p.posologia || '',
        duracao: p.duracao || '',
        observacoes: p.observacoes || '',
      })));
      setHasExtractedMeds(true);
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
      tarja: med.tarja,
    };
    setItems(newItems);
  };

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

      for (const item of validItems) {
        if (!validateMedicationName(item.medicamento)) {
          throw new Error(`Medicamento "${item.medicamento}" inválido`);
        }
        if (!validateDosage(item.dosagem)) {
          throw new Error(`Dosagem "${item.dosagem}" inválida`);
        }
      }

      const prescriptionData = {
        user_id: user.id,
        patient_name: sanitizeText(patientName),
        patient_sex: patientData?.sexo || null,
        items: validItems.map(item => ({
          medicamento: sanitizeText(item.medicamento),
          dosagem: sanitizeText(item.dosagem),
          posologia: sanitizeText(item.posologia),
          duracao: item.duracao ? sanitizeText(item.duracao) : '',
          observacoes: item.observacoes ? sanitizeText(item.observacoes) : '',
        })) as any,
        notes: notes ? sanitizeText(notes) : null,
      };

      const { error } = await supabase
        .from('prescriptions')
        .insert(prescriptionData);

      if (error) throw error;

      toast({ title: 'Receituário salvo!', description: 'O receituário foi criado com sucesso.' });
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
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
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>

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
