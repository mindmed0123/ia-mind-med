import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity, ArrowLeft, Plus, Search, User, Calendar, 
  FileText, Pill, Edit, Trash2, History 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sanitizeText, validatePatientName } from '@/lib/validation';

interface Patient {
  id: string;
  name: string;
  birth_date: string | null;
  sex: string | null;
  external_id: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  laudos_count?: number;
  prescriptions_count?: number;
}

export default function Pacientes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    sex: '',
    external_id: '',
    phone: '',
    email: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      loadPatients();
    }
  }, [user]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user?.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os pacientes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!validatePatientName(formData.name)) {
        throw new Error('Nome do paciente inválido (min 3, max 200 caracteres)');
      }

      const patientData = {
        user_id: user?.id,
        name: sanitizeText(formData.name),
        birth_date: formData.birth_date || null,
        sex: formData.sex || null,
        external_id: formData.external_id ? sanitizeText(formData.external_id) : null,
        phone: formData.phone ? sanitizeText(formData.phone) : null,
        email: formData.email ? sanitizeText(formData.email) : null,
        notes: formData.notes ? sanitizeText(formData.notes) : null,
      };

      if (editingPatient) {
        const { error } = await supabase
          .from('patients')
          .update(patientData)
          .eq('id', editingPatient.id);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Paciente atualizado' });
      } else {
        const { error } = await supabase
          .from('patients')
          .insert(patientData);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Paciente cadastrado' });
      }

      resetForm();
      loadPatients();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      birth_date: patient.birth_date || '',
      sex: patient.sex || '',
      external_id: patient.external_id || '',
      phone: patient.phone || '',
      email: patient.email || '',
      notes: patient.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este paciente?')) return;

    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Paciente excluído' });
      loadPatients();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setEditingPatient(null);
    setFormData({
      name: '',
      birth_date: '',
      sex: '',
      external_id: '',
      phone: '',
      email: '',
      notes: ''
    });
    setShowForm(false);
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.external_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
              <span className="text-xl font-bold">Pacientes</span>
            </div>
            <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
              <DialogTrigger asChild>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Paciente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome do paciente"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="birth_date">Data de Nascimento</Label>
                      <Input
                        id="birth_date"
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sex">Sexo</Label>
                      <Select
                        value={formData.sex}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, sex: value }))}
                      >
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
                  </div>
                  <div>
                    <Label htmlFor="external_id">ID/Prontuário</Label>
                    <Input
                      id="external_id"
                      value={formData.external_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, external_id: e.target.value }))}
                      placeholder="Identificador externo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={resetForm} className="flex-1">
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} className="flex-1">
                      {editingPatient ? 'Atualizar' : 'Cadastrar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou prontuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Patient List */}
        {loading ? (
          <div className="text-center py-12">
            <Activity className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-muted-foreground">Carregando pacientes...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">
                {searchTerm ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'Tente outro termo de busca' : 'Cadastre seu primeiro paciente para começar'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Paciente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((patient) => (
              <Card key={patient.id} className="hover:shadow-medium transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{patient.name}</h3>
                        {patient.external_id && (
                          <p className="text-xs text-muted-foreground">
                            #{patient.external_id}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(patient)}
                        className="h-8 w-8"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(patient.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {patient.birth_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(patient.birth_date).toLocaleDateString('pt-BR')}
                          {calculateAge(patient.birth_date) !== null && (
                            <span className="ml-1">({calculateAge(patient.birth_date)} anos)</span>
                          )}
                        </span>
                      </div>
                    )}
                    {patient.sex && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Feminino' : 'Outro'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/novo-laudo?patient_id=${patient.id}`)}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Novo Laudo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/historico-paciente/${patient.id}`)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      Histórico
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
