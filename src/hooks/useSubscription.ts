import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PlanType = 'STARTER' | 'PRO' | 'CLINIC';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PENDING_CHECKOUT' | 'INACTIVE' | 'CANCELED' | 'EXPIRED' | 'PAST_DUE';

export interface SubscriptionInfo {
  plan: PlanType;
  status: SubscriptionStatus;
  isActive: boolean;
  isPro: boolean;
  isTrial: boolean;
  remainingCredits: number | null;
  quotaUsed: number;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
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
        .in('status', ['ACTIVE', 'TRIALING'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const status = data.status as SubscriptionStatus;
        const isActiveOrTrial = status === 'ACTIVE' || status === 'TRIALING';
        
        setSubscription({
          plan: data.plan as PlanType,
          status: status,
          isActive: isActiveOrTrial,
          isPro: data.plan === 'PRO' || data.plan === 'CLINIC',
          isTrial: status === 'TRIALING',
          remainingCredits: data.remaining_starter_credits,
          quotaUsed: data.quota_used || 0,
          currentPeriodEnd: data.current_period_end,
          trialEnd: (data as any).trial_end || null,
        });
      } else {
        // No subscription at all
        setSubscription({
          plan: 'STARTER',
          status: 'PENDING_CHECKOUT',
          isActive: false,
          isPro: false,
          isTrial: false,
          remainingCredits: 0,
          quotaUsed: 0,
          currentPeriodEnd: null,
          trialEnd: null,
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
