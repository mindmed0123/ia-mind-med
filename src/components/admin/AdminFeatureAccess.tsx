import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invalidateFeatureAccessCache } from "@/hooks/useFeatureAccess";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  has_access: boolean;
}

const FEATURE_KEY = "appointments";

export function AdminFeatureAccess() {
  const { user: adminUser } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("created_at", { ascending: false })
      .limit(100);
    if (search) q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    const { data: profiles } = await q;

    const ids = (profiles ?? []).map((p) => p.id);
    let accessSet = new Set<string>();
    if (ids.length > 0) {
      const { data: access } = await supabase
        .from("feature_access")
        .select("user_id")
        .eq("feature_key", FEATURE_KEY)
        .eq("enabled", true)
        .in("user_id", ids);
      accessSet = new Set((access ?? []).map((a) => a.user_id));
    }

    setUsers(
      (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        has_access: accessSet.has(p.id),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(userId: string, current: boolean) {
    setUpdating(userId);
    if (current) {
      const { error } = await supabase
        .from("feature_access")
        .update({ enabled: false })
        .eq("user_id", userId)
        .eq("feature_key", FEATURE_KEY);
      if (error) {
        toast.error("Erro: " + error.message);
        setUpdating(null);
        return;
      }
      toast.success("Acesso removido.");
    } else {
      const { error } = await supabase.from("feature_access").upsert(
        {
          user_id: userId,
          feature_key: FEATURE_KEY,
          enabled: true,
          granted_by: adminUser?.id,
        },
        { onConflict: "user_id,feature_key" }
      );
      if (error) {
        toast.error("Erro: " + error.message);
        setUpdating(null);
        return;
      }
      toast.success("Acesso liberado.");
    }
    invalidateFeatureAccessCache(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, has_access: !current } : u)));
    setUpdating(null);
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Acesso ao módulo de Agendamentos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Libere o módulo manualmente para usuários específicos.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <Button onClick={load} variant="outline" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
          </Button>
        </div>

        <div className="border border-border rounded-lg divide-y divide-border max-h-[500px] overflow-y-auto">
          {loading && users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{u.full_name ?? "(sem nome)"}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {u.has_access && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
                      Liberado
                    </Badge>
                  )}
                  <Switch
                    checked={u.has_access}
                    disabled={updating === u.id}
                    onCheckedChange={() => toggle(u.id, u.has_access)}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
