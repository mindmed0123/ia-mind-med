import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, FileText, Pill, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface Stats {
  totalUsers: number;
  totalLaudos: number;
  totalPrescriptions: number;
  activeSubscriptions: number;
}

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  crm: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  created_at: string;
}

interface LaudoData {
  id: string;
  title: string;
  status: string;
  created_at: string;
  user_email: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalLaudos: 0,
    totalPrescriptions: 0,
    activeSubscriptions: 0,
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [recentLaudos, setRecentLaudos] = useState<LaudoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error('Acesso negado');
      navigate('/dashboard');
      return;
    }

    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin, adminLoading, navigate]);

  const loadAdminData = async () => {
    try {
      setLoading(true);

      // Buscar estatísticas
      const [usersCount, laudosCount, prescriptionsCount, activeSubsCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('laudos').select('id', { count: 'exact', head: true }),
        supabase.from('prescriptions').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      ]);

      setStats({
        totalUsers: usersCount.count || 0,
        totalLaudos: laudosCount.count || 0,
        totalPrescriptions: prescriptionsCount.count || 0,
        activeSubscriptions: activeSubsCount.count || 0,
      });

      // Buscar usuários com suas assinaturas
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          crm,
          created_at,
          subscriptions (
            plan,
            status
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (usersError) throw usersError;

      const formattedUsers: UserData[] = (usersData || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        crm: user.crm,
        subscription_plan: user.subscriptions?.[0]?.plan || null,
        subscription_status: user.subscriptions?.[0]?.status || null,
        created_at: user.created_at,
      }));

      setUsers(formattedUsers);

      // Buscar laudos recentes com email do usuário
      const { data: laudosData, error: laudosError } = await supabase
        .from('laudos')
        .select(`
          id,
          title,
          status,
          created_at,
          profiles!inner(email)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (laudosError) throw laudosError;

      const formattedLaudos: LaudoData[] = (laudosData || []).map((laudo: any) => ({
        id: laudo.id,
        title: laudo.title,
        status: laudo.status,
        created_at: laudo.created_at,
        user_email: laudo.profiles.email,
      }));

      setRecentLaudos(formattedLaudos);

    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Erro ao carregar dados administrativos');
    } finally {
      setLoading(false);
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Dashboard Administrativa</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Laudos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLaudos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receituários</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPrescriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Usuários */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Usuários Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name || '-'}</TableCell>
                  <TableCell>{user.crm || '-'}</TableCell>
                  <TableCell>
                    {user.subscription_plan ? (
                      <Badge variant={user.subscription_plan === 'PRO' ? 'default' : 'secondary'}>
                        {user.subscription_plan}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {user.subscription_status ? (
                      <Badge variant={user.subscription_status === 'ACTIVE' ? 'default' : 'destructive'}>
                        {user.subscription_status}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Laudos Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Laudos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLaudos.map((laudo) => (
                <TableRow key={laudo.id}>
                  <TableCell className="font-medium">{laudo.title}</TableCell>
                  <TableCell>{laudo.user_email}</TableCell>
                  <TableCell>
                    <Badge variant={laudo.status === 'completed' ? 'default' : 'secondary'}>
                      {laudo.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(laudo.created_at).toLocaleDateString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
