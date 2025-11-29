import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, ArrowLeft, FileText, Pill, Calendar, 
  Download, User, ExternalLink 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Patient {
  id: string;
  name: string;
  birth_date: string | null;
  sex: string | null;
  external_id: string | null;
}

interface Laudo {
  id: string;
  title: string;
  status: string;
  created_at: string;
  specialty: string | null;
  pdf_url: string | null;
}

interface Prescription {
  id: string;
  patient_name: string;
  created_at: string;
  items: any[];
  pdf_url: string | null;
}

export default function HistoricoPaciente() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && patientId) {
      loadData();
    }
  }, [user, patientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .eq('user_id', user?.id)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData);

      // Load laudos for this patient
      const { data: laudosData, error: laudosError } = await supabase
        .from('laudos')
        .select('id, title, status, created_at, specialty, pdf_url')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (!laudosError) {
        // Filter laudos by patient (would need patient_id in laudos table ideally)
        setLaudos(laudosData || []);
      }

      // Load prescriptions
      const { data: prescData, error: prescError } = await supabase
        .from('prescriptions')
        .select('id, patient_name, created_at, items, pdf_url')
        .eq('user_id', user?.id)
        .ilike('patient_name', `%${patientData.name}%`)
        .order('created_at', { ascending: false });

      if (!prescError) {
        setPrescriptions(prescData || []);
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados do paciente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Paciente não encontrado</p>
            <Button className="mt-4" onClick={() => navigate('/pacientes')}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/pacientes')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{patient.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {patient.sex && (
                    <span>{patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Feminino' : 'Outro'}</span>
                  )}
                  {patient.birth_date && (
                    <>
                      <span>•</span>
                      <span>{calculateAge(patient.birth_date)} anos</span>
                    </>
                  )}
                  {patient.external_id && (
                    <>
                      <span>•</span>
                      <span>#{patient.external_id}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex gap-3 mb-6">
          <Button onClick={() => navigate(`/novo-laudo?patient_id=${patient.id}`)}>
            <FileText className="w-4 h-4 mr-2" />
            Novo Laudo
          </Button>
          <Button variant="outline" onClick={() => navigate('/receituarios')}>
            <Pill className="w-4 h-4 mr-2" />
            Nova Receita
          </Button>
        </div>

        <Tabs defaultValue="laudos" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="laudos">
              <FileText className="w-4 h-4 mr-2" />
              Laudos ({laudos.length})
            </TabsTrigger>
            <TabsTrigger value="prescricoes">
              <Pill className="w-4 h-4 mr-2" />
              Receituários ({prescriptions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="laudos" className="mt-6">
            {laudos.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum laudo encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {laudos.map((laudo) => (
                  <Card key={laudo.id} className="hover:shadow-medium transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{laudo.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(laudo.created_at).toLocaleString('pt-BR')}</span>
                            {laudo.specialty && (
                              <>
                                <span>•</span>
                                <span>{laudo.specialty}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/novo-laudo?id=${laudo.id}`)}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          {laudo.pdf_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(laudo.pdf_url!, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="prescricoes" className="mt-6">
            {prescriptions.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <Pill className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum receituário encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((presc) => (
                  <Card key={presc.id} className="hover:shadow-medium transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(presc.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="space-y-1">
                            {(presc.items as any[]).slice(0, 3).map((item, idx) => (
                              <p key={idx} className="text-sm">
                                <span className="font-medium">{item.medicamento}</span>
                                {' - '}
                                {item.dosagem}
                              </p>
                            ))}
                            {(presc.items as any[]).length > 3 && (
                              <p className="text-xs text-muted-foreground">
                                +{(presc.items as any[]).length - 3} medicamentos
                              </p>
                            )}
                          </div>
                        </div>
                        {presc.pdf_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(presc.pdf_url!, '_blank')}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
