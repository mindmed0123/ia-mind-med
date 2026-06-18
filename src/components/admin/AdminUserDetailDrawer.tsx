import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Calendar, Gift, RefreshCw, Power, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAdminRole } from "@/hooks/useAdminRole";

interface Props {
  userId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

interface User360 {
  profile: any;
  subscription: any | null;
  onboarding: any | null;
  counts: { laudos: number; prescriptions: number; patients: number; teleconsultas: number };
  recent_laudos: { id: string; title: string; status: string; created_at: string }[];
  recent_audit: { id: string; action: string; entity: string; diff: any; created_at: string; actor_id: string | null }[];
}

const STATUS_OPTS = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "EXPIRED", "INACTIVE"];
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo", TRIALING: "Trial", PAST_DUE: "Atrasado",
  CANCELED: "Cancelado", EXPIRED: "Expirado", INACTIVE: "Inativo",
};

export const AdminUserDetailDrawer = ({ userId, onClose, onChanged }: Props) => {
  const { canManageBilling, canDeactivate } = useAdminRole();
  const [data, setData] = useState<User360 | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // form state
  const [trialDays, setTrialDays] = useState(7);
  const [courtesyPlan, setCourtesyPlan] = useState<"STARTER" | "PRO">("PRO");
  const [courtesyDays, setCourtesyDays] = useState(30);
  const [newStatus, setNewStatus] = useState("ACTIVE");
  const [statusReason, setStatusReason] = useState("");

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_user_360", { p_user_id: userId });
    if (error) { toast.error("Erro ao carregar perfil"); setData(null); }
    else setData(data as unknown as User360);
    setLoading(false);
  };

  useEffect(() => { if (userId) load(); /* eslint-disable-next-line */ }, [userId]);

  const runAction = async (payload: any, successMsg: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-action", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(successMsg);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na ação");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Perfil do Usuário</SheetTitle>
        </SheetHeader>

        {loading || !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Header */}
            <div>
              <h3 className="text-lg font-semibold">{data.profile.full_name || "Sem nome"}</h3>
              <p className="text-sm text-muted-foreground">{data.profile.email}</p>
              <div className="flex gap-2 flex-wrap mt-2">
                {data.profile.crm && <Badge variant="outline">CRM {data.profile.crm}{data.profile.crm_uf ? `/${data.profile.crm_uf}` : ""}</Badge>}
                {data.profile.specialty && <Badge variant="outline">{data.profile.specialty}</Badge>}
                {data.subscription && (
                  <>
                    <Badge>{data.subscription.plan}</Badge>
                    <Badge variant={data.subscription.status === "ACTIVE" ? "default" : "secondary"}>
                      {STATUS_LABELS[data.subscription.status] || data.subscription.status}
                    </Badge>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                ["Laudos", data.counts.laudos],
                ["Receitas", data.counts.prescriptions],
                ["Pacientes", data.counts.patients],
                ["Telemed.", data.counts.teleconsultas],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{v as number}</div>
                  <div className="text-xs text-muted-foreground">{k as string}</div>
                </div>
              ))}
            </div>

            <Tabs defaultValue="actions">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="actions">Ações</TabsTrigger>
                <TabsTrigger value="activity">Atividade</TabsTrigger>
                <TabsTrigger value="audit">Auditoria</TabsTrigger>
              </TabsList>

              <TabsContent value="actions" className="space-y-4 pt-4">
                {!canManageBilling && (
                  <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar billing.</p>
                )}
                {canManageBilling && (
                  <>
                    {/* Extend trial */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Calendar className="w-4 h-4" /> Estender trial
                      </div>
                      <div className="flex gap-2">
                        <Input type="number" min={1} max={90} value={trialDays}
                          onChange={e => setTrialDays(Number(e.target.value))} className="w-24" />
                        <Button disabled={busy} onClick={() => runAction(
                          { type: "extend_trial", user_id: userId, days: trialDays },
                          `Trial estendido em ${trialDays} dias`
                        )}>Estender</Button>
                      </div>
                    </div>

                    {/* Courtesy */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Gift className="w-4 h-4" /> Cortesia
                      </div>
                      <div className="flex gap-2">
                        <Select value={courtesyPlan} onValueChange={v => setCourtesyPlan(v as any)}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="STARTER">Starter</SelectItem>
                            <SelectItem value="PRO">Pro</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="number" min={1} max={365} value={courtesyDays}
                          onChange={e => setCourtesyDays(Number(e.target.value))} className="w-24" />
                        <Button disabled={busy} onClick={() => runAction(
                          { type: "grant_courtesy", user_id: userId, plan: courtesyPlan, days: courtesyDays },
                          `Cortesia ${courtesyPlan} por ${courtesyDays} dias concedida`
                        )}>Conceder</Button>
                      </div>
                    </div>

                    {/* Change plan */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <RefreshCw className="w-4 h-4" /> Trocar plano
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" disabled={busy || data.subscription?.plan === "STARTER"}
                          onClick={() => runAction(
                            { type: "change_plan", user_id: userId, plan: "STARTER" },
                            "Plano alterado para Starter"
                          )}>→ Starter</Button>
                        <Button variant="outline" disabled={busy || data.subscription?.plan === "PRO"}
                          onClick={() => runAction(
                            { type: "change_plan", user_id: userId, plan: "PRO" },
                            "Plano alterado para Pro"
                          )}>→ Pro</Button>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Power className="w-4 h-4" /> Alterar status
                        {!canDeactivate && (
                          <Badge variant="outline" className="ml-auto text-xs">
                            <Shield className="w-3 h-3 mr-1" />INACTIVE/CANCELED só super_admin
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTS.map(s => (
                              <SelectItem key={s} value={s}
                                disabled={(s === "INACTIVE" || s === "CANCELED") && !canDeactivate}>
                                {STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Label className="text-xs">Motivo (opcional, registrado em auditoria)</Label>
                        <Input value={statusReason} onChange={e => setStatusReason(e.target.value)} />
                        <Button disabled={busy} onClick={() => runAction(
                          { type: "set_status", user_id: userId, status: newStatus, reason: statusReason },
                          `Status alterado para ${STATUS_LABELS[newStatus]}`
                        )}>Aplicar</Button>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-2 pt-4">
                {data.recent_laudos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem laudos recentes.</p>
                ) : data.recent_laudos.map(l => (
                  <div key={l.id} className="flex items-center justify-between border rounded p-2 text-sm">
                    <div className="truncate flex-1">{l.title}</div>
                    <Badge variant="outline" className="ml-2">{l.status}</Badge>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(l.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="audit" className="space-y-2 pt-4">
                {data.recent_audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem ações registradas.</p>
                ) : data.recent_audit.map(a => (
                  <div key={a.id} className="border rounded p-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {a.diff && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                        {JSON.stringify(a.diff, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
