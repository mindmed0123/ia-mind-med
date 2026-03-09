import { useState } from "react";
import { useQuota } from "@/hooks/useQuota";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const UpgradeBanner = () => {
  const { quotaStatus, loading } = useQuota();
  const { user } = useAuth();
  const [upgrading, setUpgrading] = useState(false);

  if (loading || !quotaStatus?.hasSubscription || quotaStatus.unlimited) return null;

  const remaining = quotaStatus.remaining ?? 0;
  const isExhausted = remaining === 0;
  const isLow = remaining <= 2;

  if (!isLow && !isExhausted) return null;

  const handleUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { userId: user.id, email: user.email, plan: 'mindmed_pro' },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar upgrade');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div
      className={`rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${
        isExhausted
          ? "bg-destructive/10 border border-destructive/30"
          : "bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
      }`}
    >
      <div className="flex items-center gap-2 shrink-0">
        {isExhausted ? (
          <Rocket className="w-5 h-5 text-destructive" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {isExhausted
            ? "Suas consultas do Starter acabaram!"
            : `Apenas ${remaining} consulta${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isExhausted
            ? "Faça upgrade para o Pro e continue gerando laudos sem limites."
            : "Considere fazer upgrade para consultas ilimitadas."}
        </p>
      </div>

      <Button
        size="sm"
        className={isExhausted ? "" : "bg-amber-600 hover:bg-amber-700 text-white"}
        onClick={handleUpgrade}
        disabled={upgrading}
      >
        <Sparkles className="w-4 h-4 mr-1" />
        {upgrading ? "Processando..." : "Upgrade Pro"}
      </Button>
    </div>
  );
};
