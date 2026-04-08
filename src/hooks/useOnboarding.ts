import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useOnboarding = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsWelcome, setNeedsWelcome] = useState(false);
  const [needsLgpdConsent, setNeedsLgpdConsent] = useState(false);
  const [lgpdConsentLoading, setLgpdConsentLoading] = useState(true);
  const [isFirstLaudo, setIsFirstLaudo] = useState(false);

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

        if (count && count > 0) {
          setNeedsWelcome(false);
          setLoading(false);
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
          setNeedsWelcome(true);
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
  }, [user]);

  const markLgpdConsentGiven = useCallback(() => {
    setNeedsLgpdConsent(false);
    setLoading(true);
    if (!user) return;

    const recheck = async () => {
      const { count } = await supabase
        .from("laudos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (count && count > 0) {
        setNeedsWelcome(false);
      } else {
        const { data } = await supabase
          .from("onboarding_progress")
          .select("completed")
          .eq("user_id", user.id)
          .single();

        setNeedsWelcome(!data?.completed);
      }
      setLoading(false);
    };

    recheck();
  }, [user]);

  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("onboarding_progress")
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("user_id", user.id);
    setNeedsWelcome(false);
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
    markLgpdConsentGiven,
    completeOnboarding,
    checkFirstLaudo,
  };
};
