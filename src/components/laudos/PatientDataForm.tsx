import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, ChevronDown, ChevronUp, User, Heart, Pill, AlertTriangle } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { z } from 'zod';

const patientDataSchema = z.object({
  iniciais: z.string().max(10).optional().or(z.literal('')),
  idade: z.union([
    z.string().refine((val) => {
      if (val === '') return true;
      const num = parseInt(val);
      return !isNaN(num) && num >= 0 && num <= 120;
    }, { message: "Idade deve estar entre 0 e 120 anos" }),
    z.number().int().min(0).max(120)
  ]).optional(),
  sexo: z.string().optional().or(z.literal('')),
  especialidade: z.string().max(100).optional().or(z.literal('')),
  queixa_principal: z.string().max(1000).optional().or(z.literal(''))
});

interface PatientData {
  iniciais: string;
  nome_completo?: string;
  sexo: string;
  idade: number | string;
  especialidade: string;
  queixa_principal: string;
  sinais_vitais: {
    PA?: string;
    FC?: number;
    FR?: number;
    Temp?: string;
    SpO2?: string;
  };
  medicacoes: string[];
  alergias: string[];
  contexto_clinico?: string;
  historico?: string;
}

interface PatientDataFormProps {
  initialData?: Partial<PatientData>;
  onDataChange?: (data: PatientData) => void;
  autoSave?: boolean;
}

export const PatientDataForm = ({ 
  initialData, 
  onDataChange,
  autoSave = true 
}: PatientDataFormProps) => {
  const [data, setData] = useState<PatientData>({
    iniciais: '',
    nome_completo: '',
    sexo: '',
    idade: '',
    especialidade: '',
    queixa_principal: '',
    sinais_vitais: {},
    medicacoes: [],
    alergias: [],
    contexto_clinico: '',
    historico: '',
    ...initialData,
  });

  const [isOpen, setIsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Sync from parent only when meaningful fields actually change
  const initialDataKey = initialData ? JSON.stringify({
    iniciais: initialData.iniciais,
    nome_completo: initialData.nome_completo,
    sexo: initialData.sexo,
    idade: initialData.idade,
    queixa_principal: initialData.queixa_principal,
    medicacoes: initialData.medicacoes,
    alergias: initialData.alergias,
  }) : '';

  useEffect(() => {
    if (initialData) {
      setData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialDataKey]);

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const debouncedData = useDebounce(data, 800);

  useEffect(() => {
    if (autoSave && onDataChange && debouncedData) {
      const result = patientDataSchema.safeParse(debouncedData);
      if (result.success) {
        onDataChange(debouncedData);
        setLastSaved(new Date());
        setValidationErrors([]);
      } else {
        setValidationErrors(result.error.errors.map(e => e.message));
      }
    }
  }, [debouncedData, autoSave, onDataChange]);

  const handleChange = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  };

  const handleVitalChange = (vital: string, value: string) => {
    setData(prev => ({
      ...prev,
      sinais_vitais: { ...prev.sinais_vitais, [vital]: value },
    }));
  };

  const filledCount = [data.nome_completo || data.iniciais, data.sexo, data.idade, data.queixa_principal].filter(Boolean).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Dados do Paciente</p>
                <p className="text-xs text-muted-foreground">{filledCount}/4 campos preenchidos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {validationErrors.length > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{validationErrors.length} erro(s)</Badge>
              )}
              {lastSaved && validationErrors.length === 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <Save className="w-2.5 h-2.5" /> Salvo
                </Badge>
              )}
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-5 space-y-3">
            {/* Patient name (from linking) */}
            {data.nome_completo && (
              <div>
                <Label htmlFor="nome_completo" className="text-xs text-muted-foreground">Nome do Paciente</Label>
                <Input id="nome_completo" value={data.nome_completo} onChange={(e) => handleChange('nome_completo', e.target.value)} className="h-9 text-sm font-medium" />
              </div>
            )}
            {/* Core fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="iniciais" className="text-xs text-muted-foreground">Iniciais</Label>
                <Input id="iniciais" value={data.iniciais} onChange={(e) => handleChange('iniciais', e.target.value)} placeholder="M.M." maxLength={10} className="h-9 text-sm" />
              </div>
              <div>
                <Label htmlFor="sexo" className="text-xs text-muted-foreground">Sexo</Label>
                <Select value={data.sexo} onValueChange={(v) => handleChange('sexo', v)}>
                  <SelectTrigger id="sexo" className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                    <SelectItem value="Não informado">N/I</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="idade" className="text-xs text-muted-foreground">Idade</Label>
                <Input id="idade" type="number" value={data.idade} onChange={(e) => handleChange('idade', e.target.value)} placeholder="37" className="h-9 text-sm" />
              </div>
            </div>

            <div>
              <Label htmlFor="queixa" className="text-xs text-muted-foreground">Queixa Principal</Label>
              <Textarea id="queixa" value={data.queixa_principal} onChange={(e) => handleChange('queixa_principal', e.target.value)} placeholder="Dor torácica intermitente há 2 dias" rows={2} className="text-sm resize-none" />
            </div>

            {/* Expandable details */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8">
                  {detailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {detailsOpen ? 'Menos detalhes' : 'Mais detalhes (sinais vitais, medicações...)'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Heart className="w-3 h-3" /> Sinais Vitais
                  </Label>
                  <div className="grid grid-cols-5 gap-1.5">
                    <Input placeholder="PA" value={data.sinais_vitais.PA || ''} onChange={(e) => handleVitalChange('PA', e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="FC" type="number" value={data.sinais_vitais.FC || ''} onChange={(e) => handleVitalChange('FC', e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="FR" type="number" value={data.sinais_vitais.FR || ''} onChange={(e) => handleVitalChange('FR', e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="Temp" value={data.sinais_vitais.Temp || ''} onChange={(e) => handleVitalChange('Temp', e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="SpO2" value={data.sinais_vitais.SpO2 || ''} onChange={(e) => handleVitalChange('SpO2', e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Pill className="w-3 h-3" /> Medicações
                  </Label>
                  <Textarea value={data.medicacoes.join('\n')} onChange={(e) => handleChange('medicacoes', e.target.value.split('\n').filter(Boolean))} placeholder="Uma por linha" rows={2} className="text-xs resize-none" />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-3 h-3" /> Alergias
                  </Label>
                  <Textarea value={data.alergias.join('\n')} onChange={(e) => handleChange('alergias', e.target.value.split('\n').filter(Boolean))} placeholder="Uma por linha" rows={2} className="text-xs resize-none" />
                </div>

                <div>
                  <Label htmlFor="contexto" className="text-xs text-muted-foreground">Contexto Clínico</Label>
                  <Textarea id="contexto" value={data.contexto_clinico} onChange={(e) => handleChange('contexto_clinico', e.target.value)} placeholder="Sedentária, histórico familiar de DAC" rows={2} className="text-xs resize-none" />
                </div>

                <div>
                  <Label htmlFor="historico" className="text-xs text-muted-foreground">Histórico</Label>
                  <Textarea id="historico" value={data.historico} onChange={(e) => handleChange('historico', e.target.value)} placeholder="HAS controlada" rows={2} className="text-xs resize-none" />
                </div>

                <div>
                  <Label htmlFor="especialidade" className="text-xs text-muted-foreground">Especialidade</Label>
                  <Input id="especialidade" value={data.especialidade} onChange={(e) => handleChange('especialidade', e.target.value)} placeholder="Clínica Médica" className="h-9 text-sm" />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
