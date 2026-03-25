import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Pill, CreditCard, TrendingUp, TrendingDown, UserCheck, UserX } from "lucide-react";

interface KPIData {
  totalUsers: number;
  totalLaudos: number;
  totalPrescriptions: number;
  activeSubscriptions: number;
  trialingUsers: number;
  churned: number;
  conversionRate: number;
  mrr: number;
}

interface AdminKPICardsProps {
  data: KPIData;
}

export const AdminKPICards = ({ data }: AdminKPICardsProps) => {
  const cards = [
    { title: "Total Usuários", value: data.totalUsers, icon: Users, color: "text-primary" },
    { title: "Assinaturas Ativas", value: data.activeSubscriptions, icon: UserCheck, color: "text-accent" },
    { title: "Em Trial", value: data.trialingUsers, icon: TrendingUp, color: "text-amber-500" },
    { title: "Churn (cancelados)", value: data.churned, icon: UserX, color: "text-destructive" },
    { title: "Taxa Conversão", value: `${data.conversionRate.toFixed(1)}%`, icon: TrendingUp, color: "text-accent" },
    { title: "MRR Estimado", value: `R$ ${data.mrr.toLocaleString('pt-BR')}`, icon: CreditCard, color: "text-primary" },
    { title: "Total Laudos", value: data.totalLaudos, icon: FileText, color: "text-primary" },
    { title: "Total Receituários", value: data.totalPrescriptions, icon: Pill, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typeof card.value === 'number' ? card.value.toLocaleString('pt-BR') : card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
