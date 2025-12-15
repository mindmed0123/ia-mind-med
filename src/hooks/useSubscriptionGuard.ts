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

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
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
          console.error('Error checking subscription:', error);
          setStatus(null);
          setLoading(false);
          return;
        }

        if (!data) {
          // No subscription at all
          setStatus(null);
          setLoading(false);
          return;
        }

        setStatus(data.status as SubscriptionStatus);
        setPlan(data.plan);
        setTrialEnd(data.trial_end);
        
        // Check if trial has expired
        if (data.status === 'TRIALING' && data.trial_end) {
          const now = new Date();
          const trialEndDate = new Date(data.trial_end);
          if (now > trialEndDate) {
            setStatus('EXPIRED');
          }
        }
      } catch (err) {
        console.error('Subscription check failed:', err);
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [user, authLoading]);

  // Determine if access is allowed
  const isAllowed = status === 'ACTIVE' || status === 'TRIALING';

  // Redirect if not allowed (after loading is complete)
  useEffect(() => {
    if (!loading && !authLoading && user && !isAllowed && status !== null) {
      navigate('/medicos/assinatura-expirada', { replace: true });
    }
  }, [loading, authLoading, user, isAllowed, status, navigate]);

  return { isAllowed, status, loading: loading || authLoading, plan, trialEnd };
}
