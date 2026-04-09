import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, FileAudio, Users, TrendingUp, Calendar, Clock 
} from "lucide-react";

interface Metrics {
  totalLaudos: number;
  totalTranscriptions: number;
  totalPatients: number;
  laudosThisMonth: number;
  laudosLastMonth: number;
  recentLaudos: Array<{ id: string; title: string; created_at: string; status: string }>;
}

export const ProductivityMetrics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadMetrics();
  }, [user]);

  const loadMetrics = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      const [laudosRes, patientsRes, thisMonthRes, lastMonthRes, recentRes] = await Promise.all([
        supabase.from("laudos").select("id, transcript", { count: "exact" }).eq("user_id", user!.id),
        supabase.from("patients").select("id", { count: "exact" }).eq("user_id", user!.id),
        supabase.from("laudos").select("id", { count: "exact" }).eq("user_id", user!.id).gte("created_at", startOfMonth),
        supabase.from("laudos").select("id", { count: "exact" }).eq("user_id", user!.id).gte("created_at", startOfLastMonth).lte("created_at", endOfLastMonth),
        supabase.from("laudos").select("id, title, created_at, status").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5),
      ]);

      const allLaudos = laudosRes.data || [];
      setMetrics({
        totalLaudos: allLaudos.length,
        totalTranscriptions: allLaudos.filter((l) => l.transcript).length,
        totalPatients: patientsRes.data?.length || 0,
        laudosThisMonth: thisMonthRes.data?.length || 0,
        laudosLastMonth: lastMonthRes.data?.length || 0,
        recentLaudos: (recentRes.data || []).map((l) => ({
          id: l.id,
          title: l.title,
          created_at: l.created_at,
          status: l.status || "draft",
        })),
      });
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const growthPercent =
    metrics.laudosLastMonth > 0
      ? Math.round(((metrics.laudosThisMonth - metrics.laudosLastMonth) / metrics.laudosLastMonth) * 100)
      : metrics.laudosThisMonth > 0
      ? 100
      : 0;

  const statCards = [
    {
      icon: FileText,
      label: "Total de Laudos",
      value: metrics.totalLaudos,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: FileAudio,
      label: "Transcrições",
      value: metrics.totalTranscriptions,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: Users,
      label: "Pacientes",
      value: metrics.totalPatients,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: TrendingUp,
      label: "Este mês",
      value: metrics.laudosThisMonth,
      color: growthPercent >= 0 ? "text-green-600" : "text-destructive",
      bgColor: growthPercent >= 0 ? "bg-green-100" : "bg-destructive/10",
      badge: growthPercent !== 0 ? `${growthPercent > 0 ? "+" : ""}${growthPercent}%` : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="shadow-soft hover:shadow-medium transition-smooth">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                {stat.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    growthPercent >= 0 ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
                  }`}>
                    {stat.badge}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      {metrics.recentLaudos.length > 0 && (
        <Card className="shadow-soft">
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Atividade Recente
            </h3>
            <div className="space-y-2">
              {metrics.recentLaudos.map((laudo) => (
                <div key={laudo.id} onClick={() => navigate(`/novo-laudo?id=${laudo.id}`)} className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{laudo.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      laudo.status === "completed" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    }`}>
                      {laudo.status === "completed" ? "Finalizado" : "Rascunho"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(laudo.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
