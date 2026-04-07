import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PENDING_CHECKOUT' | 'INACTIVE' | 'CANCELED' | 'EXPIRED' | 'PAST_DUE' | null;

interface SubscriptionGuardResult {
  isAllowed: boolean;
  status: SubscriptionStatus;
  loading: boolean;
  plan: string | null;
  trialEnd: string | null;
}

export function useSubscriptionGuard(): SubscriptionGuardResult {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      setChecked(true);
      return;
    }

    const checkSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('status, plan, trial_end, stripe_subscription_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          setStatus(null);
          setLoading(false);
          setChecked(true);
          return;
        }

        if (!data) {
          // No subscription at all - user must go through checkout
          setStatus(null);
          setLoading(false);
          setChecked(true);
          return;
        }

        let currentStatus = data.status as SubscriptionStatus;
        
        // Check if trial has expired
        if (currentStatus === 'TRIALING' && data.trial_end) {
          const now = new Date();
          const trialEndDate = new Date(data.trial_end);
          if (now > trialEndDate) {
            currentStatus = 'EXPIRED';
          }
        }

        setStatus(currentStatus);
        setPlan(data.plan);
        setTrialEnd(data.trial_end);
      } catch (err) {
        setStatus(null);
      } finally {
        setLoading(false);
        setChecked(true);
      }
    };

    checkSubscription();
  }, [user, authLoading]);

  // Determine if access is allowed - ONLY ACTIVE or TRIALING
  const isAllowed = status === 'ACTIVE' || status === 'TRIALING';

  // Redirect if not allowed (after loading is complete and check is done)
  useEffect(() => {
    if (!loading && checked && user) {
      if (!isAllowed) {
        // Redirect to subscription expired/required page
        navigate('/medicos/assinatura-expirada', { replace: true });
      }
    }
  }, [loading, checked, user, isAllowed, navigate]);

  return { isAllowed, status, loading: loading || authLoading, plan, trialEnd };
}
