import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  crm: string | null;
  specialty: string | null;
  whatsapp: string | null;
  phone: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  laudos_count: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo", TRIALING: "Trial", CANCELED: "Cancelado",
  EXPIRED: "Expirado", PAST_DUE: "Atrasado", INACTIVE: "Inativo",
};
const PAGE_SIZE = 25;

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  return raw;
};
const waLink = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
};

export const AdminUserTableServer = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [status, setStatus] = useState<string>("all");
  const [plan, setPlan] = useState<string>("all");
  const [sort, setSort] = useState<string>("created_at_desc");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPage(0); }, [debouncedSearch, status, plan, sort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("admin_list_users", {
        p_search: debouncedSearch.trim() || null,
        p_status: status === "all" ? null : status,
        p_plan: plan === "all" ? null : plan,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_sort: sort,
      });
      if (cancelled) return;
      if (error) {
        setRows([]); setTotal(0);
      } else {
        const payload = (data ?? { rows: [], total: 0 }) as unknown as { rows: UserRow[]; total: number };
        setRows(payload.rows ?? []);
        setTotal(payload.total ?? 0);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [debouncedSearch, status, plan, sort, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="shadow-soft">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-lg">Usuários ({total})</CardTitle>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou CRM…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ACTIVE">Ativo</SelectItem>
              <SelectItem value="TRIALING">Trial</SelectItem>
              <SelectItem value="CANCELED">Cancelado</SelectItem>
              <SelectItem value="EXPIRED">Expirado</SelectItem>
              <SelectItem value="INACTIVE">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Plano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos planos</SelectItem>
              <SelectItem value="STARTER">Starter</SelectItem>
              <SelectItem value="PRO">Pro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at_desc">Mais recentes</SelectItem>
              <SelectItem value="created_at_asc">Mais antigos</SelectItem>
              <SelectItem value="name_asc">Nome A→Z</SelectItem>
              <SelectItem value="name_desc">Nome Z→A</SelectItem>
              <SelectItem value="email_asc">Email A→Z</SelectItem>
              <SelectItem value="laudos_desc">Mais laudos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>CRM</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Laudos</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            )}
            {rows.map(user => {
              const contact = user.whatsapp || user.phone;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name || "-"}</TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    {contact ? (
                      <a href={waLink(contact)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:underline">
                        <MessageCircle className="w-3.5 h-3.5" />{formatPhone(contact)}
                      </a>
                    ) : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>{user.crm || "-"}</TableCell>
                  <TableCell className="text-sm">{user.specialty || "-"}</TableCell>
                  <TableCell>{user.subscription_plan ? (
                    <Badge variant={user.subscription_plan === "PRO" ? "default" : "secondary"}>
                      {user.subscription_plan}
                    </Badge>) : "-"}</TableCell>
                  <TableCell>{user.subscription_status ? (
                    <Badge variant={
                      user.subscription_status === "ACTIVE" ? "default" :
                      user.subscription_status === "TRIALING" ? "secondary" : "destructive"}>
                      {STATUS_LABELS[user.subscription_status] || user.subscription_status}
                    </Badge>) : "-"}</TableCell>
                  <TableCell>{user.laudos_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading}
              onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
