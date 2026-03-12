import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Save, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PatientClinicalProfileProps {
  patientId: string;
}

export const PatientClinicalProfile = ({ patientId }: PatientClinicalProfileProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiFields, setAiFields] = useState<string[]>([]);
  const [data, setData] = useState({
    medications: [] as string[],
    allergies: [] as string[],
    comorbidities: [] as string[],
    chief_complaint: '',
    clinical_history: '',
    family_history: '',
    smoking: null as boolean | null,
    alcohol: null as boolean | null,
    clinical_notes: '',
  });

  useEffect(() => {
    loadProfile();
  }, [patientId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: patient, error } = await supabase
        .from('patients')
        .select('medications, allergies, comorbidities, chief_complaint, clinical_history, family_history, smoking, alcohol, clinical_notes, ai_extracted_fields')
        .eq('id', patientId)
        .single();

      if (error) throw error;

      const p = patient as any;
      setData({
        medications: p.medications || [],
        allergies: p.allergies || [],
        comorbidities: p.comorbidities || [],
        chief_complaint: p.chief_complaint || '',
        clinical_history: p.clinical_history || '',
        family_history: p.family_history || '',
        smoking: p.smoking,
        alcohol: p.alcohol,
        clinical_notes: p.clinical_notes || '',
      });
      setAiFields(p.ai_extracted_fields || []);
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          medications: data.medications,
          allergies: data.allergies,
          comorbidities: data.comorbidities,
          chief_complaint: data.chief_complaint || null,
          clinical_history: data.clinical_history || null,
          family_history: data.family_history || null,
          smoking: data.smoking,
          alcohol: data.alcohol,
          clinical_notes: data.clinical_notes || null,
        })
        .eq('id', patientId);

      if (error) throw error;
      toast({ title: 'Perfil salvo', description: 'Dados clínicos atualizados com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const AiBadge = ({ field }: { field: string }) => {
    if (!aiFields.includes(field)) return null;
    return (
      <Badge variant="secondary" className="text-xs gap-1 ml-2">
        <Sparkles className="w-3 h-3" />
        Extraído pela IA
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Perfil Clínico</CardTitle>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Medicações */}
          <div>
            <div className="flex items-center">
              <Label>Medicamentos em uso</Label>
              <AiBadge field="medications" />
            </div>
            <Textarea
              value={data.medications.join('\n')}
              onChange={(e) => setData(prev => ({ ...prev, medications: e.target.value.split('\n').filter(Boolean) }))}
              placeholder="Um medicamento por linha (ex: Losartana 50mg)"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Alergias */}
          <div>
            <div className="flex items-center">
              <Label>Alergias</Label>
              <AiBadge field="allergies" />
            </div>
            <Textarea
              value={data.allergies.join('\n')}
              onChange={(e) => setData(prev => ({ ...prev, allergies: e.target.value.split('\n').filter(Boolean) }))}
              placeholder="Uma alergia por linha"
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Comorbidades */}
          <div>
            <div className="flex items-center">
              <Label>Comorbidades</Label>
              <AiBadge field="comorbidities" />
            </div>
            <Textarea
              value={data.comorbidities.join('\n')}
              onChange={(e) => setData(prev => ({ ...prev, comorbidities: e.target.value.split('\n').filter(Boolean) }))}
              placeholder="Uma comorbidade por linha"
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Queixa principal */}
          <div>
            <div className="flex items-center">
              <Label>Queixa principal</Label>
              <AiBadge field="chief_complaint" />
            </div>
            <Input
              value={data.chief_complaint}
              onChange={(e) => setData(prev => ({ ...prev, chief_complaint: e.target.value }))}
              placeholder="Queixa principal da última consulta"
              className="mt-1"
            />
          </div>

          {/* Histórico clínico */}
          <div>
            <div className="flex items-center">
              <Label>Histórico clínico</Label>
              <AiBadge field="clinical_history" />
            </div>
            <Textarea
              value={data.clinical_history}
              onChange={(e) => setData(prev => ({ ...prev, clinical_history: e.target.value }))}
              placeholder="Resumo do histórico clínico"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Histórico familiar */}
          <div>
            <div className="flex items-center">
              <Label>Histórico familiar</Label>
              <AiBadge field="family_history" />
            </div>
            <Textarea
              value={data.family_history}
              onChange={(e) => setData(prev => ({ ...prev, family_history: e.target.value }))}
              placeholder="Histórico familiar relevante"
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Tabagismo & Etilismo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center mb-2">
                <Label>Tabagismo</Label>
                <AiBadge field="smoking" />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={data.smoking === true}
                  onCheckedChange={(checked) => setData(prev => ({ ...prev, smoking: checked }))}
                />
                <span className="text-sm text-muted-foreground">
                  {data.smoking === null ? 'Não informado' : data.smoking ? 'Sim' : 'Não'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center mb-2">
                <Label>Etilismo</Label>
                <AiBadge field="alcohol" />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={data.alcohol === true}
                  onCheckedChange={(checked) => setData(prev => ({ ...prev, alcohol: checked }))}
                />
                <span className="text-sm text-muted-foreground">
                  {data.alcohol === null ? 'Não informado' : data.alcohol ? 'Sim' : 'Não'}
                </span>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <div className="flex items-center">
              <Label>Observações</Label>
              <AiBadge field="clinical_notes" />
            </div>
            <Textarea
              value={data.clinical_notes}
              onChange={(e) => setData(prev => ({ ...prev, clinical_notes: e.target.value }))}
              placeholder="Outras informações clínicas relevantes"
              rows={3}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
