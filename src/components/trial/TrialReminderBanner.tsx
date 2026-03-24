import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X, Clock, Sparkles, Zap, Brain, FileText, Shield, CheckCircle2 } from "lucide-react";

const PRO_BENEFITS = [
  { icon: Brain, text: "Laudos ilimitados com IA avançada" },
  { icon: FileText, text: "Prescrições automáticas" },
  { icon: Zap, text: "Embasamento teórico completo" },
  { icon: Shield, text: "Assinatura digital e carimbo" },
  { icon: Sparkles, text: "MindChat — assistente médico IA" },
];

export function TrialReminderBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkTrial = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, trial_end")
        .eq("user_id", user.id)
        .eq("status", "TRIALING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data?.trial_end || data.status !== "TRIALING") return;

      const now = new Date();
      const trialEnd = new Date(data.trial_end);
      const diffMs = trialEnd.getTime() - now.getTime();
      const remaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (remaining > 0 && remaining <= 5) {
        setDaysLeft(remaining);
        // Show popup automatically when 5 days or less
        const popupKey = `trial_popup_${user.id}_${remaining}`;
        if (!sessionStorage.getItem(popupKey)) {
          setShowPopup(true);
          sessionStorage.setItem(popupKey, "1");
        }
      } else if (remaining > 5 && remaining <= 10) {
        // From day 10 (i.e. 5-10 days left for 15-day trial), show banner only
        setDaysLeft(remaining);
      }
    };

    checkTrial();
  }, [user]);

  if (daysLeft === null || daysLeft > 10 || dismissed) return null;

  const isUrgent = daysLeft <= 3;
  const bannerColor = isUrgent
    ? "border-destructive/50 bg-destructive/5"
    : "border-accent/50 bg-accent/5";

  return (
    <>
      {/* Persistent Banner */}
      <div className={`rounded-lg border p-3 mb-4 flex items-center justify-between ${bannerColor}`}>
        <div className="flex items-center gap-3">
          <Clock className={`w-5 h-5 shrink-0 ${isUrgent ? "text-destructive" : "text-accent"}`} />
          <div>
            <p className="text-sm font-medium">
              {daysLeft === 1
                ? "Último dia do seu trial!"
                : `Faltam ${daysLeft} dias para o fim do trial`}
            </p>
            <p className="text-xs text-muted-foreground">
              Assine o Plano Pro e continue usando sem limitações
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="gradient-primary text-xs"
            onClick={() => setShowPopup(true)}
          >
            Ver Plano Pro
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pro Benefits Popup */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-6 h-6 text-primary" />
              Plano Pro — MindMed
            </DialogTitle>
            <DialogDescription>
              {daysLeft === 1
                ? "Seu trial acaba hoje! Não perca acesso."
                : `Faltam ${daysLeft} dias para o fim do seu trial.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              {PRO_BENEFITS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">R$ 299,00</p>
              <p className="text-xs text-muted-foreground">por mês — cancele quando quiser</p>
            </div>

            <Button
              className="w-full gradient-primary"
              size="lg"
              onClick={() => {
                setShowPopup(false);
                navigate("/precos");
              }}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Assinar o Plano Pro
            </Button>

            <button
              className="w-full text-center text-xs text-muted-foreground hover:underline"
              onClick={() => setShowPopup(false)}
            >
              Continuar com o trial por mais {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
