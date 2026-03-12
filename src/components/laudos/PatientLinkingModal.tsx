import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, User, Plus, Loader2, Sparkles, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { sanitizeText, validatePatientName } from '@/lib/validation';

interface ExtractedClinicalData {
  medicacoes?: string[];
  alergias?: string[];
  comorbidades?: string[];
  queixa_principal?: string;
  historico?: string;
  historico_familiar?: string;
  tabagismo?: boolean | null;
  etilismo?: boolean | null;
  observacoes_clinicas?: string;
}

interface PatientLinkingModalProps {
  open: boolean;
  laudoId: string;
  extractedData?: ExtractedClinicalData;
  onPatientLinked: (patientId: string, patientName: string) => void;
}

interface PatientResult {
  id: string;
  name: string;
  birth_date: string | null;
  sex: string | null;
}

export const PatientLinkingModal = ({
  open,
  laudoId,
  extractedData,
  onPatientLinked,
}: PatientLinkingModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [searchName, setSearchName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [results, setResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  
  const debouncedSearch = useDebounce(searchName, 400);

  // Auto-focus
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Search patients
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2 || !user) {
      setResults([]);
      return;
    }
    
    const search = async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id, name, birth_date, sex')
          .eq('user_id', user.id)
          .ilike('name', `%${debouncedSearch}%`)
          .order('name')
          .limit(5);
        
        if (!error && data) {
          setResults(data as unknown as PatientResult[]);
        }
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setSearching(false);
      }
    };
    search();
  }, [debouncedSearch, user]);

  const mergeArrays = (existing: string[] | null, incoming: string[] | undefined): string[] => {
    const existingSet = new Set((existing || []).map(s => s.toLowerCase().trim()));
    const merged = [...(existing || [])];
    for (const item of incoming || []) {
      if (!existingSet.has(item.toLowerCase().trim())) {
        merged.push(item);
      }
    }
    return merged;
  };

  const handleSelectExisting = async (patient: PatientResult) => {
    if (!user || saving) return;
    setSaving(true);
    
    try {
      // Load existing patient data for merge
      const { data: existing, error: loadError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patient.id)
        .single();
      
      if (loadError) throw loadError;

      const existingData = existing as any;
      const aiFields: string[] = [];

      // Merge clinical data
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (extractedData) {
        // Arrays: merge without duplicates
        if (extractedData.medicacoes?.length) {
          updateData.medications = mergeArrays(existingData.medications, extractedData.medicacoes);
          aiFields.push('medications');
        }
        if (extractedData.alergias?.length) {
          updateData.allergies = mergeArrays(existingData.allergies, extractedData.alergias);
          aiFields.push('allergies');
        }
        if (extractedData.comorbidades?.length) {
          updateData.comorbidities = mergeArrays(existingData.comorbidities, extractedData.comorbidades);
          aiFields.push('comorbidities');
        }
        // Strings: overwrite with new data (most recent consultation wins)
        if (extractedData.queixa_principal) {
          updateData.chief_complaint = extractedData.queixa_principal;
          aiFields.push('chief_complaint');
        }
        if (extractedData.historico) {
          updateData.clinical_history = extractedData.historico;
          aiFields.push('clinical_history');
        }
        // Keep existing if null in new data
        if (extractedData.historico_familiar) {
          updateData.family_history = extractedData.historico_familiar;
          aiFields.push('family_history');
        }
        if (extractedData.tabagismo !== undefined && extractedData.tabagismo !== null) {
          updateData.smoking = extractedData.tabagismo;
          aiFields.push('smoking');
        }
        if (extractedData.etilismo !== undefined && extractedData.etilismo !== null) {
          updateData.alcohol = extractedData.etilismo;
          aiFields.push('alcohol');
        }
        if (extractedData.observacoes_clinicas) {
          updateData.clinical_notes = extractedData.observacoes_clinicas;
          aiFields.push('clinical_notes');
        }
        if (aiFields.length > 0) {
          // Merge with existing ai_extracted_fields
          const existingAiFields = existingData.ai_extracted_fields || [];
          updateData.ai_extracted_fields = [...new Set([...existingAiFields, ...aiFields])];
        }
      }

      // Update patient
      const { error: updateError } = await supabase
        .from('patients')
        .update(updateData)
        .eq('id', patient.id);
      
      if (updateError) throw updateError;

      // Link laudo to patient and update patient_data with name/initials
      const initials = patient.name.split(' ').map(w => w[0]).join('.').toUpperCase();
      const { error: linkError } = await supabase
        .from('laudos')
        .update({ 
          patient_id: patient.id,
          patient_data: {
            ...(extractedData || {}),
            nome_completo: patient.name,
            iniciais: initials,
          } as any,
        })
        .eq('id', laudoId);
      
      if (linkError) throw linkError;

      toast({
        title: 'Paciente vinculado!',
        description: `Laudo vinculado a ${patient.name}. ${aiFields.length > 0 ? `${aiFields.length} campos atualizados pela IA.` : ''}`,
      });
      
      onPatientLinked(patient.id, patient.name);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!user || saving) return;
    if (!validatePatientName(searchName)) {
      toast({ title: 'Nome inválido', description: 'O nome precisa ter entre 3 e 200 caracteres.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const aiFields: string[] = [];
      const patientData: Record<string, any> = {
        user_id: user.id,
        name: sanitizeText(searchName),
        birth_date: birthDate || null,
      };

      if (extractedData) {
        if (extractedData.medicacoes?.length) { patientData.medications = extractedData.medicacoes; aiFields.push('medications'); }
        if (extractedData.alergias?.length) { patientData.allergies = extractedData.alergias; aiFields.push('allergies'); }
        if (extractedData.comorbidades?.length) { patientData.comorbidities = extractedData.comorbidades; aiFields.push('comorbidities'); }
        if (extractedData.queixa_principal) { patientData.chief_complaint = extractedData.queixa_principal; aiFields.push('chief_complaint'); }
        if (extractedData.historico) { patientData.clinical_history = extractedData.historico; aiFields.push('clinical_history'); }
        if (extractedData.historico_familiar) { patientData.family_history = extractedData.historico_familiar; aiFields.push('family_history'); }
        if (extractedData.tabagismo !== undefined && extractedData.tabagismo !== null) { patientData.smoking = extractedData.tabagismo; aiFields.push('smoking'); }
        if (extractedData.etilismo !== undefined && extractedData.etilismo !== null) { patientData.alcohol = extractedData.etilismo; aiFields.push('alcohol'); }
        if (extractedData.observacoes_clinicas) { patientData.clinical_notes = extractedData.observacoes_clinicas; aiFields.push('clinical_notes'); }
        if (aiFields.length > 0) patientData.ai_extracted_fields = aiFields;
      }

      const { data: newPatient, error: createError } = await supabase
        .from('patients')
        .insert(patientData as any)
        .select('id')
        .single();

      if (createError) throw createError;

      // Link laudo
      const { error: linkError } = await supabase
        .from('laudos')
        .update({ patient_id: (newPatient as any).id })
        .eq('id', laudoId);

      if (linkError) throw linkError;

      toast({
        title: 'Paciente cadastrado!',
        description: `${searchName} cadastrado e vinculado ao laudo. ${aiFields.length > 0 ? `${aiFields.length} campos preenchidos pela IA.` : ''}`,
      });

      onPatientLinked((newPatient as any).id);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Vincular Paciente ao Laudo
          </DialogTitle>
          <DialogDescription>
            Informe o nome do paciente para vincular este laudo. Campo obrigatório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Search field */}
          <div>
            <Label htmlFor="patient-search">Nome completo do paciente *</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="patient-search"
                value={searchName}
                onChange={(e) => { setSearchName(e.target.value); setSelectedPatient(null); }}
                placeholder="Digite o nome para buscar ou cadastrar..."
                className="pl-10"
                autoComplete="off"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Search results */}
          {results.length > 0 && !selectedPatient && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pacientes encontrados</Label>
              {results.map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleSelectExisting(p)}
                >
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sex === 'M' ? 'Masculino' : p.sex === 'F' ? 'Feminino' : ''}
                          {p.birth_date && ` • ${new Date(p.birth_date).toLocaleDateString('pt-BR')}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">Vincular</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Birth date (for new patient) */}
          {searchName.length >= 3 && results.length === 0 && !searching && (
            <div>
              <Label htmlFor="birth-date">Data de nascimento (opcional)</Label>
              <Input
                id="birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {/* Extracted data preview */}
          {extractedData && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                Dados extraídos pela IA (serão salvos no perfil)
              </div>
              <div className="flex flex-wrap gap-1">
                {extractedData.medicacoes?.length ? (
                  <Badge variant="secondary" className="text-xs">
                    {extractedData.medicacoes.length} medicação(ões)
                  </Badge>
                ) : null}
                {extractedData.alergias?.length ? (
                  <Badge variant="secondary" className="text-xs">
                    {extractedData.alergias.length} alergia(s)
                  </Badge>
                ) : null}
                {extractedData.comorbidades?.length ? (
                  <Badge variant="secondary" className="text-xs">
                    {extractedData.comorbidades.length} comorbidade(s)
                  </Badge>
                ) : null}
                {extractedData.queixa_principal && (
                  <Badge variant="secondary" className="text-xs">Queixa principal</Badge>
                )}
                {extractedData.historico && (
                  <Badge variant="secondary" className="text-xs">Histórico clínico</Badge>
                )}
                {extractedData.historico_familiar && (
                  <Badge variant="secondary" className="text-xs">Histórico familiar</Badge>
                )}
                {extractedData.tabagismo !== null && extractedData.tabagismo !== undefined && (
                  <Badge variant="secondary" className="text-xs">Tabagismo</Badge>
                )}
                {extractedData.etilismo !== null && extractedData.etilismo !== undefined && (
                  <Badge variant="secondary" className="text-xs">Etilismo</Badge>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {searchName.length >= 3 && (
              <Button
                onClick={handleCreateNew}
                disabled={saving}
                className="flex-1"
                variant={results.length > 0 ? 'outline' : 'default'}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Cadastrar novo paciente
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

