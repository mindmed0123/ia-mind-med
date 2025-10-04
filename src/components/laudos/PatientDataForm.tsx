import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { z } from 'zod';
import { toast } from 'sonner';

// Validation schemas for patient medical data
const vitalSignsSchema = z.object({
  PA: z.string().regex(/^\d{2,3}\/\d{2,3}$/).optional().or(z.literal('')),
  FC: z.number().int().min(30).max(250).optional().or(z.literal('')),
  FR: z.number().int().min(8).max(60).optional().or(z.literal('')),
  Temp: z.string().regex(/^\d{2}\.\d$/).optional().or(z.literal('')),
  SpO2: z.string().regex(/^\d{2,3}%?$/).optional().or(z.literal(''))
});

const patientDataSchema = z.object({
  iniciais: z.string().max(10, "Iniciais muito longas").optional().or(z.literal('')),
  idade: z.union([
    z.string().refine((val) => {
      if (val === '') return true; // Allow empty
      const num = parseInt(val);
      return !isNaN(num) && num >= 0 && num <= 120;
    }, { message: "Idade deve estar entre 0 e 120 anos" }),
    z.number().int().min(0).max(120)
  ]).optional(),
  sexo: z.string().optional().or(z.literal('')),
  especialidade: z.string().max(100, "Especialidade muito longa").optional().or(z.literal('')),
  queixa_principal: z.string().max(1000, "Queixa principal muito longa").optional().or(z.literal(''))
});

interface PatientData {
  iniciais: string;
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

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const debouncedData = useDebounce(data, 800);

  useEffect(() => {
    if (autoSave && onDataChange && debouncedData) {
      // Validate before saving
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
    // Clear validation errors when user types
    setValidationErrors([]);
  };

  const handleVitalChange = (vital: string, value: string) => {
    setData(prev => ({
      ...prev,
      sinais_vitais: {
        ...prev.sinais_vitais,
        [vital]: value,
      },
    }));
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Dados do Paciente</CardTitle>
          <div className="flex items-center gap-2">
            {validationErrors.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {validationErrors.length} erro(s)
              </Badge>
            )}
            {lastSaved && validationErrors.length === 0 && (
              <Badge variant="outline" className="flex items-center gap-2">
                <Save className="w-3 h-3" />
                Salvo {lastSaved.toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="iniciais">Iniciais</Label>
            <Input
              id="iniciais"
              value={data.iniciais}
              onChange={(e) => handleChange('iniciais', e.target.value)}
              placeholder="Ex: M.M."
              maxLength={10}
            />
          </div>
          <div>
            <Label htmlFor="sexo">Sexo</Label>
            <Select value={data.sexo} onValueChange={(v) => handleChange('sexo', v)}>
              <SelectTrigger id="sexo">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Feminino</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
                <SelectItem value="Não informado">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="idade">Idade</Label>
            <Input
              id="idade"
              type="number"
              value={data.idade}
              onChange={(e) => handleChange('idade', e.target.value)}
              placeholder="Ex: 37"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="especialidade">Especialidade</Label>
          <Input
            id="especialidade"
            value={data.especialidade}
            onChange={(e) => handleChange('especialidade', e.target.value)}
            placeholder="Ex: Clínica Médica"
          />
        </div>

        <div>
          <Label htmlFor="queixa">Queixa Principal</Label>
          <Textarea
            id="queixa"
            value={data.queixa_principal}
            onChange={(e) => handleChange('queixa_principal', e.target.value)}
            placeholder="Ex: Dor torácica intermitente há 2 dias"
            rows={2}
          />
        </div>

        <div>
          <Label className="mb-2 block">Sinais Vitais</Label>
          <div className="grid grid-cols-5 gap-2">
            <Input
              placeholder="PA"
              value={data.sinais_vitais.PA || ''}
              onChange={(e) => handleVitalChange('PA', e.target.value)}
            />
            <Input
              placeholder="FC"
              type="number"
              value={data.sinais_vitais.FC || ''}
              onChange={(e) => handleVitalChange('FC', e.target.value)}
            />
            <Input
              placeholder="FR"
              type="number"
              value={data.sinais_vitais.FR || ''}
              onChange={(e) => handleVitalChange('FR', e.target.value)}
            />
            <Input
              placeholder="Temp"
              value={data.sinais_vitais.Temp || ''}
              onChange={(e) => handleVitalChange('Temp', e.target.value)}
            />
            <Input
              placeholder="SpO2"
              value={data.sinais_vitais.SpO2 || ''}
              onChange={(e) => handleVitalChange('SpO2', e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="medicacoes">Medicações em Uso</Label>
          <Textarea
            id="medicacoes"
            value={data.medicacoes.join('\n')}
            onChange={(e) => handleChange('medicacoes', e.target.value.split('\n').filter(Boolean))}
            placeholder="Uma medicação por linha"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="alergias">Alergias</Label>
          <Textarea
            id="alergias"
            value={data.alergias.join('\n')}
            onChange={(e) => handleChange('alergias', e.target.value.split('\n').filter(Boolean))}
            placeholder="Uma alergia por linha"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="contexto">Contexto Clínico</Label>
          <Textarea
            id="contexto"
            value={data.contexto_clinico}
            onChange={(e) => handleChange('contexto_clinico', e.target.value)}
            placeholder="Ex: Sedentária, histórico familiar de DAC"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="historico">Histórico</Label>
          <Textarea
            id="historico"
            value={data.historico}
            onChange={(e) => handleChange('historico', e.target.value)}
            placeholder="Ex: HAS controlada"
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
};
