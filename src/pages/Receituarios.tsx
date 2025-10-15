import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ArrowLeft, Plus, Trash2, Copy, Download, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  validatePatientName,
  validateMedicationName,
  validateDosage,
  sanitizeText,
  checkRateLimit
} from '@/lib/validation';

interface PrescriptionItem {
  medicamento: string;
  dosagem: string;
  posologia: string;
  duracao: string;
  observacoes?: string;
}

interface Prescription {
  id: string;
  patient_name: string;
  patient_dob: string | null;
  patient_sex: string | null;
  items: PrescriptionItem[];
  notes: string | null;
  created_at: string;
  pdf_url: string | null;
}

export default function Receituarios() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    patient_name: '',
    patient_dob: '',
    patient_sex: '',
    patient_id_external: '',
    notes: ''
  });

  const [items, setItems] = useState<PrescriptionItem[]>([
    { medicamento: '', dosagem: '', posologia: '', duracao: '', observacoes: '' }
  ]);

  useEffect(() => {
    if (user) {
      loadPrescriptions();
    }
  }, [user]);

  const loadPrescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrescriptions((data || []).map(item => ({
        ...item,
        items: item.items as unknown as PrescriptionItem[]
      })));
    } catch (error) {
      console.error('Erro ao carregar receituários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os receituários',
        variant: 'destructive'
      });
    }
  };

  const handleAddItem = () => {
    setItems([...items, { medicamento: '', dosagem: '', posologia: '', duracao: '', observacoes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PrescriptionItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Rate limiting
      if (!checkRateLimit(`prescription-${user?.id}`, 10, 60000)) {
        throw new Error('Muitas requisições. Aguarde um momento.');
      }

      // Validar nome do paciente
      if (!validatePatientName(formData.patient_name)) {
        throw new Error('Nome do paciente inválido (min 3, max 200 caracteres)');
      }

      // Validar medicamentos
      const validItems = items.filter(item => 
        item.medicamento.trim() && item.dosagem.trim() && item.posologia.trim()
      );

      if (validItems.length === 0) {
        throw new Error('Adicione pelo menos um medicamento');
      }

      // Validar cada medicamento
      for (const item of validItems) {
        if (!validateMedicationName(item.medicamento)) {
          throw new Error(`Medicamento "${item.medicamento}" inválido`);
        }
        if (!validateDosage(item.dosagem)) {
          throw new Error(`Dosagem "${item.dosagem}" inválida`);
        }
      }

      // Sanitizar dados
      const prescriptionData = {
        user_id: user?.id,
        patient_name: sanitizeText(formData.patient_name),
        patient_dob: formData.patient_dob || null,
        patient_sex: formData.patient_sex ? sanitizeText(formData.patient_sex) : null,
        patient_id_external: formData.patient_id_external ? sanitizeText(formData.patient_id_external) : null,
        items: validItems.map(item => ({
          medicamento: sanitizeText(item.medicamento),
          dosagem: sanitizeText(item.dosagem),
          posologia: sanitizeText(item.posologia),
          duracao: item.duracao ? sanitizeText(item.duracao) : '',
          observacoes: item.observacoes ? sanitizeText(item.observacoes) : ''
        })) as any,
        notes: formData.notes ? sanitizeText(formData.notes) : null
      };

      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('prescriptions')
          .update(prescriptionData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from('prescriptions')
          .insert(prescriptionData);

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: editingId ? 'Receituário atualizado' : 'Receituário criado'
      });

      resetForm();
      loadPrescriptions();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prescription: Prescription) => {
    setEditingId(prescription.id);
    setFormData({
      patient_name: prescription.patient_name,
      patient_dob: prescription.patient_dob || '',
      patient_sex: prescription.patient_sex || '',
      patient_id_external: '',
      notes: prescription.notes || ''
    });
    setItems(prescription.items);
    setShowForm(true);
  };

  const handleDuplicate = (prescription: Prescription) => {
    setEditingId(null);
    setFormData({
      patient_name: prescription.patient_name,
      patient_dob: prescription.patient_dob || '',
      patient_sex: prescription.patient_sex || '',
      patient_id_external: '',
      notes: prescription.notes || ''
    });
    setItems(prescription.items);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este receituário?')) return;

    try {
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Receituário excluído'
      });

      loadPrescriptions();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDownloadPDF = async (prescriptionId: string) => {
    try {
      toast({
        title: 'Gerando PDF',
        description: 'Aguarde...'
      });

      const { data, error } = await supabase.functions.invoke('generate-prescription-pdf', {
        body: { prescription_id: prescriptionId }
      });

      if (error) throw error;

      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar PDF',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      patient_name: '',
      patient_dob: '',
      patient_sex: '',
      patient_id_external: '',
      notes: ''
    });
    setItems([{ medicamento: '', dosagem: '', posologia: '', duracao: '', observacoes: '' }]);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Activity className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold">Receituários</span>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Receituário
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {showForm ? (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Editar Receituário' : 'Novo Receituário'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dados do Paciente */}
              <div className="space-y-4">
                <h3 className="font-semibold">Dados do Paciente</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patient_name">Nome Completo *</Label>
                    <Input
                      id="patient_name"
                      value={formData.patient_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, patient_name: e.target.value }))}
                      placeholder="Nome do paciente"
                    />
                  </div>
                  <div>
                    <Label htmlFor="patient_dob">Data de Nascimento</Label>
                    <Input
                      id="patient_dob"
                      type="date"
                      value={formData.patient_dob}
                      onChange={(e) => setFormData(prev => ({ ...prev, patient_dob: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patient_sex">Sexo</Label>
                    <Input
                      id="patient_sex"
                      value={formData.patient_sex}
                      onChange={(e) => setFormData(prev => ({ ...prev, patient_sex: e.target.value }))}
                      placeholder="M/F"
                      maxLength={1}
                    />
                  </div>
                  <div>
                    <Label htmlFor="patient_id">ID/Prontuário</Label>
                    <Input
                      id="patient_id"
                      value={formData.patient_id_external}
                      onChange={(e) => setFormData(prev => ({ ...prev, patient_id_external: e.target.value }))}
                      placeholder="ID do paciente"
                    />
                  </div>
                </div>
              </div>

              {/* Medicamentos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Medicamentos</h3>
                  <Button variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {items.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 grid md:grid-cols-2 gap-3">
                          <div>
                            <Label>Medicamento *</Label>
                            <Input
                              value={item.medicamento}
                              onChange={(e) => handleItemChange(index, 'medicamento', e.target.value)}
                              placeholder="Nome do medicamento"
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
                        {items.length > 1 && (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <Label>Posologia *</Label>
                          <Input
                            value={item.posologia}
                            onChange={(e) => handleItemChange(index, 'posologia', e.target.value)}
                            placeholder="Ex: 1 comprimido a cada 8h"
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
                      </div>

                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={item.observacoes}
                          onChange={(e) => handleItemChange(index, 'observacoes', e.target.value)}
                          placeholder="Observações adicionais"
                          rows={2}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Observações Gerais */}
              <div>
                <Label htmlFor="notes">Observações Gerais</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações adicionais sobre o receituário"
                  rows={3}
                />
              </div>

              {/* Botões */}
              <div className="flex gap-4">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={loading} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Salvando...' : 'Salvar Receituário'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground mb-4">Nenhum receituário criado ainda</p>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Receituário
                  </Button>
                </CardContent>
              </Card>
            ) : (
              prescriptions.map((prescription) => (
                <Card key={prescription.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{prescription.patient_name}</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {new Date(prescription.created_at).toLocaleString('pt-BR')}
                        </p>
                        <div className="space-y-2">
                          {prescription.items.map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{item.medicamento}</span>
                              {' - '}
                              {item.dosagem} - {item.posologia}
                              {item.duracao && ` (${item.duracao})`}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDownloadPDF(prescription.id)}
                          title="Baixar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDuplicate(prescription)}
                          title="Duplicar"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDelete(prescription.id)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
