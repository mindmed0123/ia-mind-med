import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, RotateCcw, Save, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface LaudoSectionConfig {
  key: string;
  label: string;
  enabled: boolean;
}

// Default sections that match the standard medical report
const DEFAULT_SECTIONS: LaudoSectionConfig[] = [
  { key: 'patient_card', label: 'Dados do Paciente', enabled: true },
  { key: 'anamnese', label: 'Anamnese (Queixa + HDA)', enabled: true },
  { key: 'hipotese', label: 'Hipótese Diagnóstica', enabled: true },
  { key: 'diferencial', label: 'Diagnóstico Diferencial', enabled: true },
  { key: 'cid10', label: 'CID-10', enabled: true },
  { key: 'red_flags', label: 'Sinais de Alerta', enabled: true },
  { key: 'exames', label: 'Exames Complementares', enabled: true },
  { key: 'conduta', label: 'Conduta', enabled: true },
  { key: 'prescricoes', label: 'Prescrições Sugeridas', enabled: false },
  { key: 'resumo_paciente', label: 'Resumo para o Paciente', enabled: false },
  { key: 'disclaimer', label: 'Disclaimer Legal', enabled: true },
];

const PRESETS: Record<string, { label: string; description: string; sections: string[] }> = {
  padrao: {
    label: 'Padrão Completo',
    description: 'Modelo mais usado no mercado — inclui todas as seções clínicas essenciais',
    sections: ['patient_card', 'anamnese', 'hipotese', 'diferencial', 'cid10', 'red_flags', 'exames', 'conduta', 'disclaimer'],
  },
  resumido: {
    label: 'Resumido',
    description: 'Apenas hipótese, conduta e CID-10 — ideal para retornos rápidos',
    sections: ['patient_card', 'hipotese', 'cid10', 'conduta', 'disclaimer'],
  },
  completo: {
    label: 'Completo + Prescrição',
    description: 'Inclui prescrições sugeridas e resumo para o paciente',
    sections: ['patient_card', 'anamnese', 'hipotese', 'diferencial', 'cid10', 'red_flags', 'exames', 'conduta', 'prescricoes', 'resumo_paciente', 'disclaimer'],
  },
};

interface LaudoTemplateConfigProps {
  onConfigChange: (sections: LaudoSectionConfig[]) => void;
  initialConfig?: LaudoSectionConfig[];
}

const STORAGE_KEY = 'mindmed_laudo_template';

export const LaudoTemplateConfig = ({ onConfigChange, initialConfig }: LaudoTemplateConfigProps) => {
  const { toast } = useToast();
  const [sections, setSections] = useState<LaudoSectionConfig[]>(() => {
    if (initialConfig) return initialConfig;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SECTIONS;
  });
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  // Detect if current config matches a preset
  useEffect(() => {
    const enabledKeys = sections.filter(s => s.enabled).map(s => s.key).sort().join(',');
    const match = Object.entries(PRESETS).find(([, preset]) => 
      preset.sections.sort().join(',') === enabledKeys
    );
    if (match) {
      setSelectedPreset(match[0]);
      setIsCustom(false);
    } else {
      setSelectedPreset('');
      setIsCustom(true);
    }
  }, [sections]);

  const handleToggle = (key: string, enabled: boolean) => {
    const updated = sections.map(s => s.key === key ? { ...s, enabled } : s);
    setSections(updated);
    onConfigChange(updated);
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const updated = sections.map(s => ({
      ...s,
      enabled: preset.sections.includes(s.key),
    }));
    setSections(updated);
    onConfigChange(updated);
    setSelectedPreset(presetKey);
  };

  const resetToDefault = () => {
    setSections(DEFAULT_SECTIONS);
    onConfigChange(DEFAULT_SECTIONS);
  };

  const saveConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
    toast({ title: "Modelo salvo", description: "Suas preferências de laudo foram salvas" });
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Modelo do Laudo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset Selector */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo pré-definido</Label>
          <Select value={selectedPreset || 'custom'} onValueChange={(v) => {
            if (v !== 'custom') applyPreset(v);
          }}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione um modelo..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span>{preset.label}</span>
                    {key === 'padrao' && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Recomendado
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
              {isCustom && <SelectItem value="custom">Personalizado</SelectItem>}
            </SelectContent>
          </Select>
          {selectedPreset && PRESETS[selectedPreset] && (
            <p className="text-[11px] text-muted-foreground mt-1">{PRESETS[selectedPreset].description}</p>
          )}
        </div>

        {/* Per-section toggles */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Seções do laudo</Label>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {sections.map((section) => (
              <div key={section.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Label htmlFor={`section-${section.key}`} className="text-sm font-normal cursor-pointer flex-1">
                  {section.label}
                </Label>
                <Switch
                  id={`section-${section.key}`}
                  checked={section.enabled}
                  onCheckedChange={(checked) => handleToggle(section.key, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault} className="flex-1 text-xs gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
          </Button>
          <Button size="sm" onClick={saveConfig} className="flex-1 text-xs gap-1.5">
            <Save className="w-3.5 h-3.5" /> Salvar Modelo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
