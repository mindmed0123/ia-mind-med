import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Pill, UserPlus, LogIn } from "lucide-react";

interface ActivityItem {
  type: "laudo" | "prescription" | "signup" | "login";
  title: string;
  user_email: string;
  status?: string;
  created_at: string;
}

interface AdminRecentActivityProps {
  laudos: { title: string; user_email: string; status: string; created_at: string }[];
}

const ICONS = {
  laudo: FileText,
  prescription: Pill,
  signup: UserPlus,
  login: LogIn,
};

export const AdminRecentActivity = ({ laudos }: AdminRecentActivityProps) => {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent>
        {laudos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem atividade recente</p>
        ) : (
          <div className="space-y-3">
            {laudos.map((item, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.user_email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant={item.status === "completed" ? "default" : "secondary"} className="text-xs">
                    {item.status === "completed" ? "Finalizado" : item.status === "draft" ? "Rascunho" : item.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
