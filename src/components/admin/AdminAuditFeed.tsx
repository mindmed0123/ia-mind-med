import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Props { from: Date; to: Date }

interface AuditRow {
  id: string;
  entity: string;
  entity_id: string;
  action: string;
  diff: any;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  target_email: string | null;
  target_name: string | null;
}

const PAGE_SIZE = 50;

export const AdminAuditFeed = ({ from, to }: Props) => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [actions, setActions] = useState<{ action: string; entity: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("admin_audit_actions");
      setActions((data ?? []) as { action: string; entity: string }[]);
    })();
  }, []);

  useEffect(() => { setPage(0); }, [from, to, action, entity]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("admin_audit_feed", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_action: action === "all" ? null : action,
        p_entity: entity === "all" ? null : entity,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (cancelled) return;
      const payload = (data ?? { rows: [], total: 0 }) as unknown as { rows: AuditRow[]; total: number };
      setRows(payload.rows ?? []);
      setTotal(payload.total ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from, to, action, entity, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const entities = Array.from(new Set(actions.map(a => a.entity)));
  const actionsForEntity = entity === "all" ? actions : actions.filter(a => a.entity === entity);

  return (
    <Card className="shadow-soft">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Auditoria ({total})
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas entidades</SelectItem>
              {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              {actionsForEntity.map(a => <SelectItem key={`${a.entity}.${a.action}`} value={a.action}>{a.action}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Alvo</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhuma ação registrada</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-sm">{r.actor_email || <span className="text-muted-foreground">sistema</span>}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">{r.entity}.{r.action}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {r.target_name || r.target_email || <span className="text-xs text-muted-foreground font-mono">{r.entity_id.slice(0,8)}</span>}
                </TableCell>
                <TableCell className="text-xs max-w-[280px]">
                  {r.diff ? (
                    <pre className="overflow-x-auto text-muted-foreground">{JSON.stringify(r.diff, null, 0)}</pre>
                  ) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
