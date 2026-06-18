import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, BarChart3, Users, Mail, Activity, Calendar, RefreshCw, DollarSign, ShieldCheck } from "lucide-react";
import { AdminFeatureAccess } from "@/components/admin/AdminFeatureAccess";
import { toast } from "sonner";
import { AdminKPICards } from "@/components/admin/AdminKPICards";
import { AdminConversionFunnel } from "@/components/admin/AdminConversionFunnel";
import { AdminSubscriptionBreakdown } from "@/components/admin/AdminSubscriptionBreakdown";
import { AdminSignupChart } from "@/components/admin/AdminSignupChart";
import { AdminEmailMonitor } from "@/components/admin/AdminEmailMonitor";
import { AdminUserTableServer } from "@/components/admin/AdminUserTableServer";
import { AdminRecentActivity } from "@/components/admin/AdminRecentActivity";
import { AdminRevenueDashboard } from "@/components/admin/AdminRevenueDashboard";
import { AdminAuditFeed } from "@/components/admin/AdminAuditFeed";
import { PeriodSelector, type PeriodPreset, computeRange } from "@/components/admin/PeriodSelector";

interface LaudoData {
  title: string;
  user_email: string;
  status: string;
  created_at: string;
}

interface BusinessMetrics {
  mrr: number;
  arr: number;
  active: number;
  trialing: number;
  churned_period: number;
  new_signups: number;
  total_users: number;
  trial_conversion: number;
  avg_ticket: number;
}

interface FunnelData {
  totalSignups: number;
  lgpdConsent: number;
  onboardingCompleted: number;
  firstLaudo: number;
  activePaid: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { canManageBilling, loading: roleLoading } = useAdminRole();

  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const range = useMemo(() => computeRange(period), [period]);

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData>({
    totalSignups: 0, lgpdConsent: 0, onboardingCompleted: 0, firstLaudo: 0, activePaid: 0,
  });
  const [subBreakdown, setSubBreakdown] = useState<{ status: string; plan: string; count: number }[]>([]);
  const [signupChart, setSignupChart] = useState<{ day: string; count: number }[]>([]);
  const [recentLaudos, setRecentLaudos] = useState<LaudoData[]>([]);
  const [counts, setCounts] = useState<{ laudos: number; prescriptions: number }>({ laudos: 0, prescriptions: 0 });
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, period, refreshKey]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const fromIso = range.from.toISOString();
      const toIso = range.to.toISOString();

      const [metricsRes, breakdownRes, signupRes, onboardingRes, lgpdRes, laudosRes, laudosCountRes, prescriptionsCountRes] = await Promise.all([
        canManageBilling
          ? supabase.rpc("admin_business_metrics", { p_from: fromIso, p_to: toIso })
          : Promise.resolve({ data: null, error: null }),
        supabase.rpc("admin_subscription_breakdown"),
        supabase.rpc("admin_signup_series", { p_from: fromIso, p_to: toIso, p_granularity: "day" }),
        supabase.from("onboarding_progress").select("completed, first_laudo_id"),
        supabase.from("profiles").select("lgpd_consent_given", { count: "exact", head: false }),
        supabase.from("laudos").select("title, status, created_at, profiles!inner(email)").order("created_at", { ascending: false }).limit(20),
        supabase.from("laudos").select("id", { count: "exact", head: true }),
        supabase.from("prescriptions").select("id", { count: "exact", head: true }),
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data as unknown as BusinessMetrics);

      if (breakdownRes.data) {
        setSubBreakdown((breakdownRes.data as unknown as { status: string; plan: string; count: number }[]) ?? []);
      }

      if (signupRes.data) {
        const series = (signupRes.data as unknown as { bucket: string; count: number }[]) ?? [];
        const map = new Map(series.map(s => [s.bucket, s.count]));
        const chart: { day: string; count: number }[] = [];
        const cursor = new Date(range.from);
        const end = new Date(range.to);
        // cap iterations to keep chart sane
        const maxDays = 120;
        let i = 0;
        while (cursor <= end && i < maxDays) {
          const key = cursor.toISOString().split("T")[0];
          chart.push({ day: key, count: map.get(key) ?? 0 });
          cursor.setDate(cursor.getDate() + 1);
          i++;
        }
        setSignupChart(chart);
      }

      // Funnel
      const onboardingData = (onboardingRes.data ?? []) as { completed: boolean; first_laudo_id: string | null }[];
      const lgpdData = (lgpdRes.data ?? []) as { lgpd_consent_given: boolean | null }[];
      const lgpdCount = lgpdData.filter(p => p.lgpd_consent_given).length;
      const onboardingCompleted = onboardingData.filter(o => o.completed).length;
      const firstLaudo = onboardingData.filter(o => o.first_laudo_id).length;

      const freshMetrics = (metricsRes.data ?? null) as unknown as BusinessMetrics | null;
      const totalUsers = freshMetrics?.total_users ?? lgpdData.length;
      const activePaid = freshMetrics?.active ?? 0;

      setFunnelData({
        totalSignups: totalUsers,
        lgpdConsent: lgpdCount,
        onboardingCompleted,
        firstLaudo,
        activePaid,
      });

      const formattedLaudos: LaudoData[] = ((laudosRes.data ?? []) as any[]).map((l: any) => ({
        title: l.title,
        user_email: l.profiles?.email || "—",
        status: l.status || "draft",
        created_at: l.created_at,
      }));
      setRecentLaudos(formattedLaudos);
      setCounts({
        laudos: laudosCountRes.count ?? 0,
        prescriptions: prescriptionsCountRes.count ?? 0,
      });
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-backfill-subscription-amounts");
      if (error) throw error;
      const r = data as { updated: number; skipped: number; failed: number; total: number };
      toast.success(`Backfill: ${r.updated} atualizadas, ${r.skipped} sem preço, ${r.failed} falharam (de ${r.total})`);
      setRefreshKey(k => k + 1);
    } catch (e) {
      toast.error(`Backfill falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackfilling(false);
    }
  };

  if (adminLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const kpiData = {
    totalUsers: metrics?.total_users ?? 0,
    totalLaudos: counts.laudos,
    totalPrescriptions: counts.prescriptions,
    activeSubscriptions: metrics?.active ?? 0,
    trialingUsers: metrics?.trialing ?? 0,
    churned: metrics?.churned_period ?? 0,
    conversionRate: metrics?.trial_conversion ?? 0,
    mrr: metrics?.mrr ?? 0,
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-bold">Dashboard Administrativa</h1>
            <p className="text-sm text-muted-foreground">
              Período: {range.from.toLocaleDateString("pt-BR")} – {range.to.toLocaleDateString("pt-BR")}
            </p>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {canManageBilling && (
            <Button
              variant="outline"
              size="sm"
              onClick={runBackfill}
              disabled={backfilling}
              title="Sincroniza os valores cobrados de cada assinatura do Stripe"
            >
              {backfilling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sync MRR (Stripe)
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-8">
            <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-2" />Visão Geral</TabsTrigger>
            {canManageBilling && <TabsTrigger value="finance"><DollarSign className="w-4 h-4 mr-2" />Financeiro</TabsTrigger>}
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />Usuários</TabsTrigger>
            <TabsTrigger value="emails"><Mail className="w-4 h-4 mr-2" />Emails</TabsTrigger>
            <TabsTrigger value="audit"><ShieldCheck className="w-4 h-4 mr-2" />Auditoria</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="w-4 h-4 mr-2" />Atividade</TabsTrigger>
            <TabsTrigger value="modules"><Calendar className="w-4 h-4 mr-2" />Módulos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {loading && !metrics ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <AdminKPICards data={kpiData} />
                {canManageBilling && metrics && (
                  <div className="text-xs text-muted-foreground">
                    ARR: R$ {metrics.arr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ·
                    Ticket médio: R$ {metrics.avg_ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ·
                    Novos cadastros no período: {metrics.new_signups}
                  </div>
                )}
                <div className="grid lg:grid-cols-2 gap-6">
                  <AdminConversionFunnel data={funnelData} />
                  <AdminSubscriptionBreakdown data={subBreakdown} />
                </div>
                <AdminSignupChart data={signupChart} />
              </>
            )}
          </TabsContent>

          {canManageBilling && (
            <TabsContent value="finance">
              <AdminRevenueDashboard from={range.from} to={range.to} />
            </TabsContent>
          )}

          <TabsContent value="users">
            <AdminUserTableServer />
          </TabsContent>

          <TabsContent value="emails">
            <AdminEmailMonitor />
          </TabsContent>

          <TabsContent value="audit">
            <AdminAuditFeed from={range.from} to={range.to} />
          </TabsContent>


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
