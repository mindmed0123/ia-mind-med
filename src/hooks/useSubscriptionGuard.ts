import { useEffect, useState, useRef } from 'react';
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

// Simple in-memory cache to avoid re-querying on every navigation
let cachedResult: { status: SubscriptionStatus; plan: string | null; trialEnd: string | null; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30s

export function useSubscriptionGuard(): SubscriptionGuardResult {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SubscriptionStatus>(cachedResult?.status ?? null);
  const [plan, setPlan] = useState<string | null>(cachedResult?.plan ?? null);
  const [trialEnd, setTrialEnd] = useState<string | null>(cachedResult?.trialEnd ?? null);
  const [loading, setLoading] = useState(!cachedResult || Date.now() - cachedResult.ts > CACHE_TTL);
  const [checked, setChecked] = useState(!!cachedResult && Date.now() - cachedResult.ts <= CACHE_TTL);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      setChecked(true);
      return;
    }

    // Use cache if fresh
    if (cachedResult && Date.now() - cachedResult.ts <= CACHE_TTL) {
      setStatus(cachedResult.status);
      setPlan(cachedResult.plan);
      setTrialEnd(cachedResult.trialEnd);
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

        if (abortRef.current) return;

        if (error || !data) {
          const s = null;
          setStatus(s);
          cachedResult = { status: s, plan: null, trialEnd: null, ts: Date.now() };
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

        if (abortRef.current) return;

        setStatus(currentStatus);
        setPlan(data.plan);
        setTrialEnd(data.trial_end);
        cachedResult = { status: currentStatus, plan: data.plan, trialEnd: data.trial_end, ts: Date.now() };
      } catch {
        if (!abortRef.current) setStatus(null);
      } finally {
        if (!abortRef.current) {
          setLoading(false);
          setChecked(true);
        }
      }
    };

    checkSubscription();

    // Safety timeout - never loading for more than 5s
    const timeout = setTimeout(() => {
      setLoading(false);
      setChecked(true);
    }, 5000);

    return () => {
      abortRef.current = true;
      clearTimeout(timeout);
    };
  }, [user, authLoading]);

  const isAllowed = status === 'ACTIVE' || status === 'TRIALING';

  // Redirect if not allowed
  useEffect(() => {
    if (!loading && checked && user && !isAllowed) {
      navigate('/medicos/assinatura-expirada', { replace: true });
    }
  }, [loading, checked, user, isAllowed, navigate]);

  return { isAllowed, status, loading: loading || authLoading, plan, trialEnd };
}

// Allow external cache invalidation (e.g. after checkout)
export function invalidateSubscriptionCache() {
  cachedResult = null;
}
