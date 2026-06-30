import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { ProFeatureGate } from '@/components/pro/ProFeatureGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, ArrowLeft, Plus, Trash2, Copy, Download, Save, Crown, Sparkles, Pill, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  validatePatientName,
  validateMedicationName,
  validateDosage,
  sanitizeText,
  checkRateLimit
} from '@/lib/validation';
import { MedicationSearch, type MedicationResult } from '@/components/prescription/MedicationSearch';

interface PrescriptionItem {
  medicamento: string;
  dosagem: string;
  posologia: string;
  duracao: string;
  observacoes?: string;
  parceiro?: string | null;
  tarja?: string | null;
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
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fromLaudo, setFromLaudo] = useState(false);

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

  // Check if coming from a laudo
  useEffect(() => {
    if (searchParams.get('from') === 'laudo') {
      const savedData = sessionStorage.getItem('prescriptionFromLaudo');
      if (savedData) {
        try {
          const laudoData = JSON.parse(savedData);
          setFormData(prev => ({
            ...prev,
            patient_name: laudoData.patient_name || '',
            notes: `Diagnóstico: ${laudoData.diagnosis || 'N/I'}\n\nConduta: ${laudoData.conduct || 'N/I'}\n\nCID-10: ${laudoData.cid10?.join(', ') || 'N/I'}`
          }));
          setFromLaudo(true);
          setShowForm(true);
          sessionStorage.removeItem('prescriptionFromLaudo');
          
          toast({
            title: 'Dados importados do laudo',
            description: 'Preencha os medicamentos para completar o receituário.',
          });
        } catch (e) {
        }
      }
    }
  }, [searchParams]);

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
        description: 'Aguarde enquanto o documento é gerado...'
      });

      const { data, error } = await supabase.functions.invoke('generate-prescription-pdf', {
        body: { prescription_id: prescriptionId }
      });

      if (error) throw error;

      if (data?.html) {
        // Importar dinamicamente as funções de PDF
        const { generatePdf, downloadPdf, uploadPdfToStorage } = await import('@/lib/pdf-generator');
        
        const fileName = `receituario-${prescriptionId}-${Date.now()}.pdf`;
        
        // Gerar PDF no cliente
        const pdfBlob = await generatePdf({
          html: data.html,
          fileName,
          verifyUrl: '' // Receitas não precisam de verificação por enquanto
        });

        // Upload para storage
        const filePath = `prescriptions/${prescriptionId}/exports/${Date.now()}.pdf`;
        const signedUrl = await uploadPdfToStorage(pdfBlob, filePath, supabase);

        // Atualizar prescrição com URL do PDF
        await supabase
          .from('prescriptions')
          .update({ pdf_url: signedUrl })
          .eq('id', prescriptionId);

        // Download automático
        downloadPdf(pdfBlob, fileName);

        toast({
          title: 'PDF gerado!',
          description: 'O receituário foi gerado e baixado com sucesso.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar PDF',
        description: error.message || 'Não foi possível gerar o PDF',
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
    setFromLaudo(false);
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
              {subscription?.isPro && (
                <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  PRO
                </span>
              )}
            </div>
            {!showForm && subscription?.isPro && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Receituário
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {!subscription?.isPro ? (
          <ProFeatureGate feature="o Receituário Completo">
            <div />
          </ProFeatureGate>
        ) : showForm ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{editingId ? 'Editar Receituário' : 'Novo Receituário'}</CardTitle>
                  {fromLaudo && (
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Dados importados automaticamente do laudo
                    </CardDescription>
                  )}
                </div>
                {fromLaudo && (
                  <span className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Do Laudo
                  </span>
                )}
              </div>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                          >
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
                <Button 
                  onClick={handleSave} 
                  disabled={loading} 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Salvando...' : (editingId ? 'Atualizar Receituário' : 'Salvar Receituário')}
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
                          className="hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDuplicate(prescription)}
                          title="Duplicar"
                          className="hover:bg-secondary/80 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDelete(prescription.id)}
                          title="Excluir"
                          className="hover:bg-destructive/90 transition-colors"
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
