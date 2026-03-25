import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, CheckCircle, XCircle, AlertTriangle, Ban } from "lucide-react";

interface EmailLog {
  id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  message_id: string | null;
}

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  suppressed: number;
  pending: number;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: typeof Mail }> = {
  sent: { label: "Enviado", variant: "default", icon: CheckCircle },
  pending: { label: "Pendente", variant: "secondary", icon: Mail },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  dlq: { label: "DLQ", variant: "destructive", icon: XCircle },
  suppressed: { label: "Suprimido", variant: "outline", icon: Ban },
  bounced: { label: "Bounced", variant: "destructive", icon: AlertTriangle },
  complained: { label: "Reclamação", variant: "destructive", icon: AlertTriangle },
};

export const AdminEmailMonitor = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<EmailStats>({ total: 0, sent: 0, failed: 0, suppressed: 0, pending: 0 });
  const [timeRange, setTimeRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const getStartDate = (range: string) => {
    const now = new Date();
    switch (range) {
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  useEffect(() => {
    loadEmailData();
  }, [timeRange, statusFilter]);

  const loadEmailData = async () => {
    setLoading(true);
    try {
      const startDate = getStartDate(timeRange);

      let query = supabase
        .from("email_send_log")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Deduplicate by message_id (keep latest)
      const seen = new Map<string, EmailLog>();
      for (const row of (data || []) as EmailLog[]) {
        const key = row.message_id || row.id;
        if (!seen.has(key) || new Date(row.created_at) > new Date(seen.get(key)!.created_at)) {
          seen.set(key, row);
        }
      }
      const deduped = Array.from(seen.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setLogs(deduped.slice(0, 50));

      // Compute stats
      const s: EmailStats = { total: deduped.length, sent: 0, failed: 0, suppressed: 0, pending: 0 };
      for (const row of deduped) {
        if (row.status === "sent") s.sent++;
        else if (row.status === "failed" || row.status === "dlq") s.failed++;
        else if (row.status === "suppressed") s.suppressed++;
        else if (row.status === "pending") s.pending++;
      }
      setStats(s);
    } catch (err) {
      console.error("Error loading email data:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-soft">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-accent">{stats.sent}</div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Falharam</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Últimas 24h</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="failed">Falhos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="suppressed">Suprimidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Log de Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum email encontrado no período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const config = STATUS_CONFIG[log.status] || { label: log.status, variant: "secondary" as const, icon: Mail };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.template_name}</TableCell>
                      <TableCell className="text-sm">{log.recipient_email}</TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {log.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
