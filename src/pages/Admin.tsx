import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, BarChart3, Users, Mail, Activity, Calendar } from "lucide-react";
import { AdminFeatureAccess } from "@/components/admin/AdminFeatureAccess";
import { toast } from "sonner";
import { AdminKPICards } from "@/components/admin/AdminKPICards";
import { AdminConversionFunnel } from "@/components/admin/AdminConversionFunnel";
import { AdminSubscriptionBreakdown } from "@/components/admin/AdminSubscriptionBreakdown";
import { AdminSignupChart } from "@/components/admin/AdminSignupChart";
import { AdminEmailMonitor } from "@/components/admin/AdminEmailMonitor";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { AdminRecentActivity } from "@/components/admin/AdminRecentActivity";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  crm: string | null;
  specialty: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  laudos_count: number;
  created_at: string;
}

interface LaudoData {
  title: string;
  user_email: string;
  status: string;
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true);

  // KPI data
  const [kpiData, setKpiData] = useState({
    totalUsers: 0,
    totalLaudos: 0,
    totalPrescriptions: 0,
    activeSubscriptions: 0,
    trialingUsers: 0,
    churned: 0,
    conversionRate: 0,
    mrr: 0,
  });

  // Funnel data
  const [funnelData, setFunnelData] = useState({
    totalSignups: 0,
    lgpdConsent: 0,
    onboardingCompleted: 0,
    firstLaudo: 0,
    activePaid: 0,
  });

  // Subscription breakdown
  const [subBreakdown, setSubBreakdown] = useState<{ status: string; plan: string; count: number }[]>([]);

  // Signup chart
  const [signupChart, setSignupChart] = useState<{ day: string; count: number }[]>([]);

  // Users & Activity
  const [users, setUsers] = useState<UserData[]>([]);
  const [recentLaudos, setRecentLaudos] = useState<LaudoData[]>([]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    if (isAdmin) loadAllData();
  }, [isAdmin, adminLoading, navigate]);

  const loadAllData = async () => {
    try {
      setLoading(true);

      const [
        usersRes,
        laudosRes,
        prescriptionsRes,
        subsRes,
        onboardingRes,
        profilesRes,
        laudosDetailRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("laudos").select("id", { count: "exact", head: true }),
        supabase.from("prescriptions").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("status, plan"),
        supabase.from("onboarding_progress").select("completed, first_laudo_id"),
        supabase.from("profiles").select("id, email, full_name, crm, specialty, lgpd_consent_given, created_at, subscriptions(plan, status)").order("created_at", { ascending: false }).limit(50),
        supabase.from("laudos").select("title, status, created_at, profiles!inner(email)").order("created_at", { ascending: false }).limit(20),
      ]);

      const totalUsers = usersRes.count || 0;
      const totalLaudos = laudosRes.count || 0;
      const totalPrescriptions = prescriptionsRes.count || 0;
      const subs = (subsRes.data || []) as { status: string; plan: string }[];

      // Subscription breakdown
      const breakdownMap = new Map<string, number>();
      let activeCount = 0;
      let trialingCount = 0;
      let canceledCount = 0;
      let activePaidCount = 0;

      for (const s of subs) {
        const key = `${s.status}|${s.plan}`;
        breakdownMap.set(key, (breakdownMap.get(key) || 0) + 1);
        if (s.status === "ACTIVE") { activeCount++; activePaidCount++; }
        if (s.status === "TRIALING") trialingCount++;
        if (s.status === "CANCELED" || s.status === "EXPIRED") canceledCount++;
      }

      const breakdown = Array.from(breakdownMap.entries()).map(([key, count]) => {
        const [status, plan] = key.split("|");
        return { status, plan, count };
      });

      // MRR estimate
      const mrrStarter = subs.filter(s => s.status === "ACTIVE" && s.plan === "STARTER").length * 99.9;
      const mrrPro = subs.filter(s => s.status === "ACTIVE" && s.plan === "PRO").length * 299;
      const mrr = mrrStarter + mrrPro;

      // Conversion rate
      const conversionRate = totalUsers > 0 ? (activePaidCount / totalUsers) * 100 : 0;

      setKpiData({
        totalUsers,
        totalLaudos,
        totalPrescriptions,
        activeSubscriptions: activeCount,
        trialingUsers: trialingCount,
        churned: canceledCount,
        conversionRate,
        mrr,
      });

      setSubBreakdown(breakdown);

      // Funnel
      const onboardingData = (onboardingRes.data || []) as { completed: boolean; first_laudo_id: string | null }[];
      const profilesData = (profilesRes.data || []) as any[];
      const lgpdConsentCount = profilesData.filter((p: any) => p.lgpd_consent_given).length;
      const onboardingCompleted = onboardingData.filter(o => o.completed).length;
      const firstLaudoCount = onboardingData.filter(o => o.first_laudo_id).length;

      setFunnelData({
        totalSignups: totalUsers,
        lgpdConsent: lgpdConsentCount,
        onboardingCompleted,
        firstLaudo: firstLaudoCount,
        activePaid: activePaidCount,
      });

      // Signup chart (from profiles created_at)
      const dayMap = new Map<string, number>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const p of profilesData) {
        const day = new Date(p.created_at).toISOString().split("T")[0];
        if (new Date(p.created_at) >= thirtyDaysAgo) {
          dayMap.set(day, (dayMap.get(day) || 0) + 1);
        }
      }

      // Fill missing days
      const chartData: { day: string; count: number }[] = [];
      for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        chartData.push({ day: key, count: dayMap.get(key) || 0 });
      }
      setSignupChart(chartData);

      // Users table with laudo counts
      const laudoCountMap = new Map<string, number>();
      // Get laudo counts per user
      const { data: laudosByUser } = await supabase
        .from("laudos")
        .select("user_id");

      for (const l of (laudosByUser || [])) {
        laudoCountMap.set(l.user_id, (laudoCountMap.get(l.user_id) || 0) + 1);
      }

      const formattedUsers: UserData[] = profilesData.map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        crm: u.crm,
        specialty: u.specialty,
        subscription_plan: u.subscriptions?.[0]?.plan || null,
        subscription_status: u.subscriptions?.[0]?.status || null,
        laudos_count: laudoCountMap.get(u.id) || 0,
        created_at: u.created_at,
      }));

      setUsers(formattedUsers);

      // Recent laudos
      const formattedLaudos: LaudoData[] = ((laudosDetailRes.data || []) as any[]).map((l: any) => ({
        title: l.title,
        user_email: l.profiles?.email || "—",
        status: l.status || "draft",
        created_at: l.created_at,
      }));

      setRecentLaudos(formattedLaudos);

    } catch (error) {
      toast.error("Erro ao carregar dados");
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Dashboard Administrativa</h1>
            <p className="text-sm text-muted-foreground">Visão completa da MindMed</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="emails">
              <Mail className="w-4 h-4 mr-2" />
              Emails
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="w-4 h-4 mr-2" />
              Atividade
            </TabsTrigger>
            <TabsTrigger value="modules">
              <Calendar className="w-4 h-4 mr-2" />
              Módulos
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <AdminKPICards data={kpiData} />

            <div className="grid lg:grid-cols-2 gap-6">
              <AdminConversionFunnel data={funnelData} />
              <AdminSubscriptionBreakdown data={subBreakdown} />
            </div>

            <AdminSignupChart data={signupChart} />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <AdminUserTable users={users} />
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails">
            <AdminEmailMonitor />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <AdminRecentActivity laudos={recentLaudos} />
          </TabsContent>

          <TabsContent value="modules">
            <AdminFeatureAccess />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
