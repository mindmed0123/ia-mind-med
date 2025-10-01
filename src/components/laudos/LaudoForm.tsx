import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LaudoFormProps {
  onLaudoGenerated: (laudoId: string) => void;
}

export const LaudoForm = ({ onLaudoGenerated }: LaudoFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Patient data
    iniciais: "",
    sexo: "",
    idade: "",
    
    // Clinical data
    specialty: "",
    chief_complaint: "",
    transcript: "",
    
    // Vitals
    pa: "",
    fc: "",
    fr: "",
    temp: "",
    spo2: "",
    
    // Other clinical info
    meds: "",
    allergies: "",
    exam_findings: "",
    contexto_clinico: "",
    historico: "",
    hipoteses_previas: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.transcript || !formData.chief_complaint) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha ao menos a transcrição e a queixa principal",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create laudo record first
      const { data: laudo, error: laudoError } = await supabase
        .from('laudos')
        .insert({
          user_id: user.id,
          title: `Laudo - ${formData.iniciais || 'Paciente'} - ${new Date().toLocaleDateString()}`,
          specialty: formData.specialty,
          status: 'processing',
        })
        .select()
        .single();

      if (laudoError) throw laudoError;

      // Prepare data for AI
      const payload = {
        laudo_id: laudo.id,
        patient: {
          iniciais: formData.iniciais,
          sexo: formData.sexo,
          idade: formData.idade ? parseInt(formData.idade) : null,
        },
        specialty: formData.specialty,
        chief_complaint: formData.chief_complaint,
        transcript: formData.transcript,
        vitals: {
          PA: formData.pa,
          FC: formData.fc,
          FR: formData.fr,
          Temp: formData.temp,
          SpO2: formData.spo2,
        },
        meds: formData.meds ? formData.meds.split('\n').filter(m => m.trim()) : [],
        allergies: formData.allergies ? formData.allergies.split('\n').filter(a => a.trim()) : [],
        exam_findings: formData.exam_findings,
        contexto_clinico: formData.contexto_clinico,
        historico: formData.historico,
        hipoteses_previas: formData.hipoteses_previas ? formData.hipoteses_previas.split('\n').filter(h => h.trim()) : [],
        regras_produto: {
          nao_diagnostico_definitivo: true,
          evitar_alucinacao: true,
        },
      };

      // Call edge function
      const { data, error } = await supabase.functions.invoke('generate-laudo', {
        body: payload,
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Laudo gerado com sucesso!",
        description: "O laudo foi processado pela IA e está pronto para visualização",
      });

      onLaudoGenerated(laudo.id);

    } catch (error: any) {
      console.error('Erro ao gerar laudo:', error);
      toast({
        title: "Erro ao gerar laudo",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados do Paciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="iniciais">Iniciais *</Label>
              <Input
                id="iniciais"
                value={formData.iniciais}
                onChange={(e) => handleChange('iniciais', e.target.value)}
                placeholder="Ex: M.M."
                maxLength={10}
              />
            </div>
            <div>
              <Label htmlFor="sexo">Sexo</Label>
              <Select value={formData.sexo} onValueChange={(v) => handleChange('sexo', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="O">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="idade">Idade</Label>
              <Input
                id="idade"
                type="number"
                value={formData.idade}
                onChange={(e) => handleChange('idade', e.target.value)}
                placeholder="Ex: 37"
                min="0"
                max="150"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="specialty">Especialidade</Label>
            <Select value={formData.specialty} onValueChange={(v) => handleChange('specialty', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Clínica Médica">Clínica Médica</SelectItem>
                <SelectItem value="Cardiologia">Cardiologia</SelectItem>
                <SelectItem value="Pediatria">Pediatria</SelectItem>
                <SelectItem value="Ortopedia">Ortopedia</SelectItem>
                <SelectItem value="Dermatologia">Dermatologia</SelectItem>
                <SelectItem value="Neurologia">Neurologia</SelectItem>
                <SelectItem value="Psiquiatria">Psiquiatria</SelectItem>
                <SelectItem value="Outra">Outra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="chief_complaint">Queixa Principal *</Label>
            <Textarea
              id="chief_complaint"
              value={formData.chief_complaint}
              onChange={(e) => handleChange('chief_complaint', e.target.value)}
              placeholder="Ex: Dor torácica intermitente há 2 dias"
              rows={2}
              required
            />
          </div>

          <div>
            <Label htmlFor="transcript">Transcrição da Consulta *</Label>
            <Textarea
              id="transcript"
              value={formData.transcript}
              onChange={(e) => handleChange('transcript', e.target.value)}
              placeholder="Cole aqui a transcrição completa da consulta..."
              rows={8}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sinais Vitais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="pa">PA</Label>
              <Input
                id="pa"
                value={formData.pa}
                onChange={(e) => handleChange('pa', e.target.value)}
                placeholder="130/85"
              />
            </div>
            <div>
              <Label htmlFor="fc">FC</Label>
              <Input
                id="fc"
                value={formData.fc}
                onChange={(e) => handleChange('fc', e.target.value)}
                placeholder="88 bpm"
              />
            </div>
            <div>
              <Label htmlFor="fr">FR</Label>
              <Input
                id="fr"
                value={formData.fr}
                onChange={(e) => handleChange('fr', e.target.value)}
                placeholder="18 irpm"
              />
            </div>
            <div>
              <Label htmlFor="temp">Temp</Label>
              <Input
                id="temp"
                value={formData.temp}
                onChange={(e) => handleChange('temp', e.target.value)}
                placeholder="36.7°C"
              />
            </div>
            <div>
              <Label htmlFor="spo2">SpO2</Label>
              <Input
                id="spo2"
                value={formData.spo2}
                onChange={(e) => handleChange('spo2', e.target.value)}
                placeholder="98%"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Adicionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="exam_findings">Achados do Exame Físico</Label>
            <Textarea
              id="exam_findings"
              value={formData.exam_findings}
              onChange={(e) => handleChange('exam_findings', e.target.value)}
              placeholder="Descreva os achados relevantes do exame físico..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="meds">Medicações em Uso (uma por linha)</Label>
            <Textarea
              id="meds"
              value={formData.meds}
              onChange={(e) => handleChange('meds', e.target.value)}
              placeholder="Losartana 50mg/dia&#10;Metformina 500mg 2x/dia"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="allergies">Alergias (uma por linha)</Label>
            <Textarea
              id="allergies"
              value={formData.allergies}
              onChange={(e) => handleChange('allergies', e.target.value)}
              placeholder="Dipirona&#10;Penicilina"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="historico">Histórico Clínico</Label>
            <Textarea
              id="historico"
              value={formData.historico}
              onChange={(e) => handleChange('historico', e.target.value)}
              placeholder="HAS controlada, DM tipo 2..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="contexto_clinico">Contexto Clínico</Label>
            <Textarea
              id="contexto_clinico"
              value={formData.contexto_clinico}
              onChange={(e) => handleChange('contexto_clinico', e.target.value)}
              placeholder="Sedentário, histórico familiar de DAC..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="hipoteses_previas">Hipóteses Prévias (uma por linha)</Label>
            <Textarea
              id="hipoteses_previas"
              value={formData.hipoteses_previas}
              onChange={(e) => handleChange('hipoteses_previas', e.target.value)}
              placeholder="Dor musculoesquelética&#10;Ansiedade"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Gerando laudo com IA...
          </>
        ) : (
          'Gerar Laudo por IA'
        )}
      </Button>
    </form>
  );
};
