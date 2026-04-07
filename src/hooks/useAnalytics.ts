import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export const useAnalytics = () => {
  const { user } = useAuth();

  const trackEvent = useCallback(
    async (eventName: string, eventData: Record<string, unknown> = {}) => {
      if (!user?.id) return;
      try {
        await supabase.from("analytics_events" as any).insert({
          user_id: user.id,
          event_name: eventName,
          event_data: eventData,
        });
      } catch (e) {
      }
    },
    [user?.id]
  );

  return { trackEvent };
};
