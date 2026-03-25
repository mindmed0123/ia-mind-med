import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SignupDay {
  day: string;
  count: number;
}

interface AdminSignupChartProps {
  data: SignupDay[];
}

export const AdminSignupChart = ({ data }: AdminSignupChartProps) => {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.day + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">Cadastros por Dia (30 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Cadastros" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
