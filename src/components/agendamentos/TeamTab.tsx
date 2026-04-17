import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OrgMember } from "@/hooks/useOrganization";
import { useOrgInvites, OrgInvite } from "@/hooks/useOrgInvites";
import {
  Loader2, UserPlus, Mail, Copy, X, Trash2, Crown, Shield, Stethoscope, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const SEAT_PRICE_BRL = 299;

interface Props {
  organizationId: string;
  ownerUserId: string;
  currentUserId: string;
  members: OrgMember[];
  onMembersChanged: () => void;
}

export function TeamTab({ organizationId, ownerUserId, currentUserId, members, onMembersChanged }: Props) {
  const isOwner = currentUserId === ownerUserId;
  const { invites, loading: loadingInvites, reload: reloadInvites } = useOrgInvites(organizationId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeMember, setRemoveMember] = useState<OrgMember | null>(null);

  const activeMembers = members.filter((m) => m.is_active);
  const pendingInvites = invites.filter((i) => i.status === "pending");
  const extraSeats = Math.max(0, activeMembers.length - 1);
  const monthlyExtra = extraSeats * SEAT_PRICE_BRL;

  return (
    <div className="space-y-4">
      {/* Cobrança summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-primary" />
              Equipe da clínica
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {activeMembers.length} {activeMembers.length === 1 ? "médico ativo" : "médicos ativos"}
              {extraSeats > 0 && ` · +R$ ${monthlyExtra.toLocaleString("pt-BR")}/mês`}
            </div>
          </div>
          {isOwner && (
            <Button onClick={() => setInviteOpen(true)} size="sm">
              <UserPlus className="w-4 h-4 mr-1.5" />
              Convidar médico
            </Button>
          )}
        </CardContent>
      </Card>

      {!isOwner && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Apenas o dono da clínica pode convidar ou remover médicos.
        </div>
      )}

      {/* Active members */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Membros ativos
        </div>
        {activeMembers.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                style={{ backgroundColor: m.display_color ?? "#3b82f6" }}
              >
                {(m.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{m.display_name ?? "Médico"}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {m.role === "owner" ? (
                    <Badge variant="default" className="text-[10px] h-4 px-1.5">
                      <Crown className="w-2.5 h-2.5 mr-0.5" /> Dono
                    </Badge>
                  ) : m.role === "doctor" ? (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      <Stethoscope className="w-2.5 h-2.5 mr-0.5" /> Médico
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      <Shield className="w-2.5 h-2.5 mr-0.5" /> Equipe
                    </Badge>
                  )}
                </div>
              </div>
              {isOwner && m.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setRemoveMember(m)}
                  title="Remover da equipe"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending invites */}
      {(loadingInvites || pendingInvites.length > 0) && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Convites pendentes
          </div>
          {loadingInvites ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            pendingInvites.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                invite={inv}
                isOwner={isOwner}
                onChanged={reloadInvites}
              />
            ))
          )}
        </div>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationId={organizationId}
        currentExtraSeats={extraSeats}
        onInvited={() => {
          reloadInvites();
          onMembersChanged();
        }}
      />

      <AlertDialog open={!!removeMember} onOpenChange={(o) => !o && setRemoveMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover médico da clínica?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeMember?.display_name}</strong> perderá acesso à clínica imediatamente.
              Sua assinatura será reduzida em <strong>R$ {SEAT_PRICE_BRL}/mês</strong> no próximo ciclo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!removeMember) return;
                const { error } = await supabase
                  .from("organization_members")
                  .update({ is_active: false })
                  .eq("id", removeMember.id);
                if (error) {
                  toast.error(error.message);
                } else {
                  toast.success("Médico removido da equipe");
                  // Sync seats with Stripe
                  const newCount = activeMembers.length - 1;
                  await supabase.functions.invoke("manage-org-seats", {
                    body: { organization_id: organizationId, owner_id: ownerUserId, seats: newCount },
                  }).catch(() => {});
                  await supabase
                    .from("organizations")
                    .update({ seats_paid: newCount })
                    .eq("id", organizationId);
                  onMembersChanged();
                }
                setRemoveMember(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PendingInviteRow({
  invite, isOwner, onChanged,
}: { invite: OrgInvite; isOwner: boolean; onChanged: () => void }) {
  const inviteUrl = `${window.location.origin}/aceitar-convite?token=${invite.token}`;
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{invite.full_name || invite.email}</div>
            <div className="text-xs text-muted-foreground truncate">{invite.email}</div>
          </div>
          <Badge variant="outline" className="text-[10px]">Aguardando</Badge>
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10"
              onClick={async () => {
                if (!confirm("Cancelar este convite?")) return;
                const { error } = await supabase
                  .from("organization_invites")
                  .update({ status: "cancelled" })
                  .eq("id", invite.id);
                if (error) toast.error(error.message);
                else { toast.success("Convite cancelado"); onChanged(); }
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-background rounded-md px-2 py-1.5 border">
          <code className="text-[11px] flex-1 truncate text-muted-foreground">{inviteUrl}</code>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              toast.success("Link copiado!");
            }}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteDialog({
  open, onOpenChange, organizationId, currentExtraSeats, onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  currentExtraSeats: number;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[1]);
  const [sending, setSending] = useState(false);

  const projectedExtra = currentExtraSeats + 1;
  const projectedMonthly = projectedExtra * SEAT_PRICE_BRL;

  async function handleSend() {
    if (!email.trim()) {
      toast.error("Informe o e-mail");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-org-invite", {
        body: {
          organization_id: organizationId,
          email: email.trim(),
          full_name: fullName.trim() || null,
          display_color: color,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Convite enviado!");
      setEmail("");
      setFullName("");
      onInvited();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar convite");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Convidar médico
          </DialogTitle>
          <DialogDescription>
            O médico receberá um e-mail com um link para entrar na sua equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="invite-email" className="text-xs">E-mail do médico*</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="medico@exemplo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="invite-name" className="text-xs">Nome (opcional)</Label>
            <Input
              id="invite-name"
              placeholder="Dr. João Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Cor na agenda</Label>
            <div className="flex gap-1.5 mt-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/30 rounded-md p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="text-xs text-foreground">
              <strong>+R$ {SEAT_PRICE_BRL}/mês</strong> serão adicionados à sua assinatura quando o médico
              aceitar o convite. Sua nova mensalidade extra ficará em <strong>R$ {projectedMonthly.toLocaleString("pt-BR")}/mês</strong>.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
