import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface Props {
  from: Date;
  to: Date;
}

interface Summary {
  mrr_now: number;
  arr_now: number;
  new_mrr: number;
  churned_mrr: number;
  net_new_mrr: number;
  revenue_period: number;
  avg_ticket: number;
  active_subs: number;
}
interface Bucket { bucket: string; mrr: number; active_subs: number; new_subs: number }

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const AdminRevenueDashboard = ({ from, to }: Props) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  const granularity = useMemo(() => {
    const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
    if (days > 90) return "month";
    if (days > 31) return "week";
    return "day";
  }, [from, to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sumRes, serRes] = await Promise.all([
        supabase.rpc("admin_financial_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
        supabase.rpc("admin_revenue_series", {
          p_from: from.toISOString(), p_to: to.toISOString(), p_granularity: granularity,
        }),
      ]);
      if (cancelled) return;
      if (sumRes.data) setSummary(sumRes.data as unknown as Summary);
      if (serRes.data) setSeries((serRes.data as unknown as Bucket[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from, to, granularity]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!summary) return <p className="text-sm text-muted-foreground">Sem dados.</p>;

  const kpis = [
    { label: "MRR atual", value: brl(summary.mrr_now), icon: DollarSign, accent: "text-primary" },
    { label: "ARR", value: brl(summary.arr_now), icon: TrendingUp, accent: "text-primary" },
    { label: "Novo MRR", value: brl(summary.new_mrr), icon: TrendingUp, accent: "text-green-600" },
    { label: "MRR perdido", value: brl(summary.churned_mrr), icon: TrendingDown, accent: "text-destructive" },
    { label: "Net new MRR", value: brl(summary.net_new_mrr), icon: TrendingUp, accent: summary.net_new_mrr >= 0 ? "text-green-600" : "text-destructive" },
    { label: "Ticket médio", value: brl(summary.avg_ticket), icon: Users, accent: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="shadow-soft">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <k.icon className="w-3.5 h-3.5" />{k.label}
              </div>
              <div className={`text-lg font-bold mt-1 ${k.accent}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">MRR ao longo do tempo ({granularity})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$ ${Math.round(Number(v))}`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number | string, k: string) => k === "mrr" ? brl(Number(v)) : v}
                  labelFormatter={(l) => l}
                />
                <Legend />
                <Line type="monotone" dataKey="mrr" name="MRR (R$)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="active_subs" name="Assinaturas ativas" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} yAxisId={0} />
                <Line type="monotone" dataKey="new_subs" name="Novas" stroke="#16a34a" strokeWidth={2} dot={false} yAxisId={0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
