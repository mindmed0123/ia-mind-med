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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const check = async () => {
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
        // No record yet — new user
        setNeedsOnboarding(true);
        // Create progress record
        await supabase.from("onboarding_progress" as any).insert({
          user_id: user.id,
          current_step: 1,
        });
      }
      setLoading(false);
    };

    check();
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

  return { state, loading, needsOnboarding, updateStep, completeOnboarding };
};
