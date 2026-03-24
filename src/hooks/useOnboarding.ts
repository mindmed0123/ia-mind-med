import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingState {
  currentStep: number;
  completed: boolean;
  firstLaudoId?: string;
  startedAt?: string;
}

export const useOnboarding = () => {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({ currentStep: 1, completed: false });
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsLgpdConsent, setNeedsLgpdConsent] = useState(false);
  const [lgpdConsentLoading, setLgpdConsentLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setLgpdConsentLoading(false);
      return;
    }

    const check = async () => {
      // 1. Check LGPD consent first
      const { data: profile } = await supabase
        .from("profiles")
        .select("lgpd_consent_given, full_name, crm")
        .eq("id", user.id)
        .single();

      if (!profile?.lgpd_consent_given) {
        setNeedsLgpdConsent(true);
        setLgpdConsentLoading(false);
        // Don't check onboarding yet — wait for consent
        setLoading(false);
        return;
      }

      setNeedsLgpdConsent(false);
      setLgpdConsentLoading(false);

      // 2. Users with active subscription AND complete profile skip onboarding
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .in("status", ["ACTIVE", "TRIALING"])
        .limit(1)
        .maybeSingle();

      if (sub && profile?.full_name && profile?.crm) {
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      // 3. Check onboarding progress
      const { data } = await supabase
        .from("onboarding_progress" as any)
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data && (data as any).completed) {
        setNeedsOnboarding(false);
      } else if (data) {
        setState({
          currentStep: (data as any).current_step || 1,
          completed: false,
          firstLaudoId: (data as any).first_laudo_id,
          startedAt: (data as any).created_at,
        });
        setNeedsOnboarding(true);
      } else {
        // No record yet — new user needs onboarding
        setNeedsOnboarding(true);
        await supabase.from("onboarding_progress" as any).insert({
          user_id: user.id,
          current_step: 1,
        });
      }
      setLoading(false);
    };

    check();
  }, [user]);

  const markLgpdConsentGiven = useCallback(() => {
    setNeedsLgpdConsent(false);
    // Re-trigger onboarding check
    setLoading(true);
    if (!user) return;

    const recheckOnboarding = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, crm")
        .eq("id", user.id)
        .single();

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .in("status", ["ACTIVE", "TRIALING"])
        .limit(1)
        .maybeSingle();

      if (sub && profile?.full_name && profile?.crm) {
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("onboarding_progress" as any)
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data && (data as any).completed) {
        setNeedsOnboarding(false);
      } else if (data) {
        setState({
          currentStep: (data as any).current_step || 1,
          completed: false,
          firstLaudoId: (data as any).first_laudo_id,
          startedAt: (data as any).created_at,
        });
        setNeedsOnboarding(true);
      } else {
        setNeedsOnboarding(true);
        await supabase.from("onboarding_progress" as any).insert({
          user_id: user.id,
          current_step: 1,
        });
      }
      setLoading(false);
    };

    recheckOnboarding();
  }, [user]);

  const updateStep = useCallback(
    async (step: number) => {
      if (!user) return;
      const stepField = `step${step - 1}_completed_at`;
      await supabase
        .from("onboarding_progress" as any)
        .update({
          current_step: step,
          [stepField]: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      setState((s) => ({ ...s, currentStep: step }));
    },
    [user]
  );

  const completeOnboarding = useCallback(
    async (firstLaudoId?: string, timeSavedSeconds?: number) => {
      if (!user) return;

      // Auto-delete the test laudo if one was created
      if (firstLaudoId) {
        await supabase
          .from("laudos")
          .delete()
          .eq("id", firstLaudoId)
          .eq("user_id", user.id);
      }

      await supabase
        .from("onboarding_progress" as any)
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          step4_completed_at: new Date().toISOString(),
          first_laudo_id: firstLaudoId || null,
          time_saved_seconds: timeSavedSeconds || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      setState((s) => ({ ...s, completed: true }));
      setNeedsOnboarding(false);
    },
    [user]
  );

  return { state, loading, needsOnboarding, needsLgpdConsent, lgpdConsentLoading, updateStep, completeOnboarding, markLgpdConsentGiven };
};
