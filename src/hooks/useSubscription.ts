import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PlanType = 'STARTER' | 'PRO' | 'CLINIC';

export interface SubscriptionInfo {
  plan: PlanType;
  status: string;
  isActive: boolean;
  isPro: boolean;
  remainingCredits: number | null;
  quotaUsed: number;
  currentPeriodEnd: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSubscription({
          plan: data.plan as PlanType,
          status: data.status,
          isActive: data.status === 'ACTIVE',
          isPro: data.plan === 'PRO' || data.plan === 'CLINIC',
          remainingCredits: data.remaining_starter_credits,
          quotaUsed: data.quota_used || 0,
          currentPeriodEnd: data.current_period_end,
        });
      } else {
        // No subscription - treat as STARTER
        setSubscription({
          plan: 'STARTER',
          status: 'TRIALING',
          isActive: false,
          isPro: false,
          remainingCredits: 0,
          quotaUsed: 0,
          currentPeriodEnd: null,
        });
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshSubscription = () => {
    setLoading(true);
    fetchSubscription();
  };

  return { subscription, loading, refreshSubscription };
}
