import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SubscriptionBreakdown {
  status: string;
  plan: string;
  count: number;
}

interface AdminSubscriptionBreakdownProps {
  data: SubscriptionBreakdown[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "hsl(var(--accent))",
  TRIALING: "hsl(45, 93%, 47%)",
  CANCELED: "hsl(var(--destructive))",
  EXPIRED: "hsl(var(--muted-foreground))",
  PAST_DUE: "hsl(25, 95%, 53%)",
  INACTIVE: "hsl(var(--border))",
  PENDING_CHECKOUT: "hsl(270, 50%, 60%)",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  TRIALING: "Em Trial",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  PAST_DUE: "Atrasado",
  INACTIVE: "Inativo",
  PENDING_CHECKOUT: "Pendente",
};

export const AdminSubscriptionBreakdown = ({ data }: AdminSubscriptionBreakdownProps) => {
  const chartData = data.map((d) => ({
    name: `${STATUS_LABELS[d.status] || d.status} (${d.plan})`,
    value: d.count,
    color: STATUS_COLORS[d.status] || "hsl(var(--muted))",
  }));

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">Assinaturas por Status</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma assinatura encontrada</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${value}`}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-4">
              {data.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === "ACTIVE" ? "default" : d.status === "TRIALING" ? "secondary" : "destructive"}>
                      {STATUS_LABELS[d.status] || d.status}
                    </Badge>
                    <span className="text-muted-foreground">{d.plan}</span>
                  </div>
                  <span className="font-semibold">{d.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
