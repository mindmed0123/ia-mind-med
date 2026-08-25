import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const skipKey = (userId: string) => `mm_onboarding_snoozed_${userId}`;
const firstRealKey = (userId: string) => `mm_first_real_laudo_${userId}`;

/** Registra uma única vez o primeiro laudo com paciente de verdade. */
async function logFirstRealLaudo(userId: string) {
  try {
    if (localStorage.getItem(firstRealKey(userId)) === "1") return;
    const { count } = await supabase
      .from("laudos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("patient_id", "is", null);
    if (!count || count < 1) return;
    localStorage.setItem(firstRealKey(userId), "1");
    await supabase.from("analytics_events" as any).insert({
      user_id: userId,
      event_name: "first_real_laudo",
      event_data: { laudos_com_paciente: count },
    });
  } catch {
    /* instrumentação nunca pode quebrar o app */
  }
}

export const useOnboarding = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsWelcome, setNeedsWelcome] = useState(false);
  const [needsLgpdConsent, setNeedsLgpdConsent] = useState(false);
  const [lgpdConsentLoading, setLgpdConsentLoading] = useState(true);
  const [isFirstLaudo, setIsFirstLaudo] = useState(false);
  const [laudoCount, setLaudoCount] = useState<number | null>(null);

  const isSnoozed = useCallback(() => {
    if (!user) return false;
    try {
      return sessionStorage.getItem(skipKey(user.id)) === "1";
    } catch {
      return false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setLgpdConsentLoading(false);
      return;
    }

    const check = async () => {
      try {
        // 1. Check LGPD consent
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("lgpd_consent_given, full_name, crm")
          .eq("id", user.id)
          .single();

        if (profileError) {
          // Network or RLS error - allow access rather than block
          setNeedsLgpdConsent(false);
          setLgpdConsentLoading(false);
          setNeedsWelcome(false);
          setLoading(false);
          return;
        }

        if (!profile?.lgpd_consent_given) {
          setNeedsLgpdConsent(true);
          setLgpdConsentLoading(false);
          setLoading(false);
          return;
        }

        setNeedsLgpdConsent(false);
        setLgpdConsentLoading(false);

        // 2. Check if user has ANY laudo → if yes, skip welcome
        const { count, error: laudoError } = await supabase
          .from("laudos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (laudoError) {
          // Fail open
          setNeedsWelcome(false);
          setLoading(false);
          return;
        }

        setLaudoCount(count ?? 0);

        if (count && count > 0) {
          setNeedsWelcome(false);
          setLoading(false);
          void logFirstRealLaudo(user.id);
          return;
        }

        // 3. Check onboarding_progress
        const { data } = await supabase
          .from("onboarding_progress")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (data && data.completed) {
          setNeedsWelcome(false);
        } else {
          // Snooze is per-session only: the invite returns on the next login.
          setNeedsWelcome(!isSnoozed());
          if (!data) {
            try {
              await supabase.from("onboarding_progress").insert({
                user_id: user.id,
                current_step: 1,
              });
            } catch {
              // Ignore insert errors
            }
          }
        }
      } catch {
        // Any unexpected error - fail open to not block the user
        setNeedsLgpdConsent(false);
        setNeedsWelcome(false);
      } finally {
        setLgpdConsentLoading(false);
        setLoading(false);
      }
    };

    check();
  }, [user, isSnoozed]);

  const markLgpdConsentGiven = useCallback(() => {
    setNeedsLgpdConsent(false);
    setLoading(true);
    if (!user) return;

    const recheck = async () => {
      const { count } = await supabase
        .from("laudos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      setLaudoCount(count ?? 0);

      if (count && count > 0) {
        setNeedsWelcome(false);
      } else {
        const { data } = await supabase
          .from("onboarding_progress")
          .select("completed")
          .eq("user_id", user.id)
          .single();

        setNeedsWelcome(!data?.completed && !isSnoozed());
      }
      setLoading(false);
    };

    recheck();
  }, [user, isSnoozed]);

  /** Fecha o convite apenas nesta sessão. Volta no próximo login. */
  const snoozeOnboarding = useCallback(() => {
    if (user) {
      try {
        sessionStorage.setItem(skipKey(user.id), "1");
      } catch {
        /* noop */
      }
    }
    setNeedsWelcome(false);
  }, [user]);

  /** Marca definitivamente concluído — só ao gerar o primeiro laudo real. */
  const completeOnboarding = useCallback(
    async (laudoId?: string) => {
      if (!user) return;
      await supabase
        .from("onboarding_progress")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(laudoId ? { first_laudo_id: laudoId } : {}),
        } as any)
        .eq("user_id", user.id);
      setNeedsWelcome(false);
      setLaudoCount((c) => (c === null ? 1 : Math.max(c, 1)));
    },
    [user]
  );

  const refreshLaudoCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("laudos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setLaudoCount(count ?? 0);
  }, [user]);

  const checkFirstLaudo = useCallback(async () => {
    if (!user) return false;
    const { count } = await supabase
      .from("laudos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "draft");

    const isFirst = count === 1;
    setIsFirstLaudo(isFirst);
    return isFirst;
  }, [user]);

  return {
    loading,
    needsWelcome,
    needsLgpdConsent,
    lgpdConsentLoading,
    isFirstLaudo,
    laudoCount,
    markLgpdConsentGiven,
    snoozeOnboarding,
    completeOnboarding,
    refreshLaudoCount,
    checkFirstLaudo,
  };
};
