import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Stethoscope, Brain } from 'lucide-react';
import {
  Conselho,
  ESPECIALIDADES_CRM,
  ESPECIALIDADES_CRP,
  UFS,
} from '@/lib/professional-profile';
import type { ProfessionalProfile } from '@/hooks/useProfessionalProfile';

interface Props {
  initial?: ProfessionalProfile | null;
  onSaved: () => void;
  onSkip?: () => void; // quando presente, mostra "Preencher depois"
}

export const ProfessionalProfileForm = ({ initial, onSaved, onSkip }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [conselho, setConselho] = useState<Conselho | null>(initial?.conselho ?? null);
  const [registroNumero, setRegistroNumero] = useState(initial?.registro_numero ?? '');
  const [registroUf, setRegistroUf] = useState(initial?.registro_uf ?? '');
  const [especialidade, setEspecialidade] = useState(initial?.especialidade ?? '');
  const [especialidadeOutra, setEspecialidadeOutra] = useState(initial?.especialidade_outra ?? '');

  // Ao trocar de conselho, limpa especialidade que não pertence à nova lista
  useEffect(() => {
    const lista = conselho === 'CRP' ? ESPECIALIDADES_CRP : ESPECIALIDADES_CRM;
    if (especialidade && !lista.includes(especialidade)) {
      setEspecialidade('');
      setEspecialidadeOutra('');
    }
  }, [conselho]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = conselho === 'CRP' ? ESPECIALIDADES_CRP : ESPECIALIDADES_CRM;

  const handleSave = async () => {
    if (!conselho) {
      toast({ title: 'Escolha seu conselho', description: 'Selecione CRM ou CRP para continuar.', variant: 'destructive' });
      return;
    }
    if (!registroNumero.trim()) {
      toast({ title: 'Registro obrigatório', description: `Informe seu número de ${conselho}.`, variant: 'destructive' });
      return;
    }
    if (!registroUf) {
      toast({ title: 'UF obrigatória', description: 'Selecione a UF de inscrição.', variant: 'destructive' });
      return;
    }
    if (!especialidade) {
      toast({ title: 'Especialidade obrigatória', description: 'Selecione sua especialidade ou área de atuação.', variant: 'destructive' });
      return;
    }
    if (especialidade === 'Outra' && !especialidadeOutra.trim()) {
      toast({ title: 'Descreva sua área', description: 'Você escolheu "Outra" — escreva qual.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          conselho,
          registro_numero: registroNumero.trim(),
          registro_uf: registroUf,
          especialidade,
          especialidade_outra: especialidade === 'Outra' ? especialidadeOutra.trim() : null,
          perfil_completo_em: new Date().toISOString(),
          // Mantém os campos legados crm/crm_uf/specialty em sincronia para o resto do app
          crm: registroNumero.replace(/\D/g, '') || registroNumero.trim(),
          crm_uf: registroUf,
          specialty: especialidade,
        })
        .eq('id', user?.id);

      if (error) throw error;
      toast({ title: 'Perfil salvo', description: 'Seus documentos agora seguem o seu conselho.' });
      onSaved();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Conselho */}
      <div>
        <Label className="mb-2 block">Conselho profissional *</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setConselho('CRM')}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              conselho === 'CRM' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Stethoscope className={`w-7 h-7 ${conselho === 'CRM' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="font-semibold text-sm">CRM · Medicina</span>
          </button>
          <button
            type="button"
            onClick={() => setConselho('CRP')}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              conselho === 'CRP' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Brain className={`w-7 h-7 ${conselho === 'CRP' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="font-semibold text-sm">CRP · Psicologia</span>
          </button>
        </div>
      </div>

      {/* Registro */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor="pp_registro">Número de registro *</Label>
          <Input
            id="pp_registro"
            value={registroNumero}
            onChange={(e) => setRegistroNumero(e.target.value)}
            placeholder={conselho === 'CRP' ? '06/123456' : '123456'}
            disabled={!conselho}
          />
        </div>
        <div>
          <Label>UF *</Label>
          <Select value={registroUf} onValueChange={setRegistroUf} disabled={!conselho}>
            <SelectTrigger>
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Especialidade */}
      <div>
        <Label>{conselho === 'CRP' ? 'Área de atuação *' : 'Especialidade *'}</Label>
        <Select value={especialidade} onValueChange={setEspecialidade} disabled={!conselho}>
          <SelectTrigger>
            <SelectValue placeholder={conselho ? 'Selecione' : 'Escolha o conselho primeiro'} />
          </SelectTrigger>
          <SelectContent>
            {lista.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {especialidade === 'Outra' && (
        <div>
          <Label htmlFor="pp_outra">Qual área? *</Label>
          <Input
            id="pp_outra"
            value={especialidadeOutra}
            onChange={(e) => setEspecialidadeOutra(e.target.value)}
            placeholder="Descreva sua área de atuação"
          />
        </div>
      )}

      <div className="space-y-3">
        <Button onClick={handleSave} className="w-full" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Preencher depois
          </button>
        )}
      </div>
    </div>
  );
};
