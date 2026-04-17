/**
 * Central app state store using a lightweight pub/sub pattern.
 * Replaces scattered useState + useEffect patterns for subscription,
 * quota and auth data that were causing redundant DB queries.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ──── Types ────
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

// ──── In-memory cache (singleton across all hook instances) ────
let _cache: {
  subscription: SubscriptionInfo | null;
  fetchedAt: number;
  fetchPromise: Promise<SubscriptionInfo | null> | null;
} = { subscription: null, fetchedAt: 0, fetchPromise: null };

const CACHE_TTL = 30_000; // 30s
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function invalidateAppCache() {
  _cache = { subscription: null, fetchedAt: 0, fetchPromise: null };
  notifyListeners();
}

async function fetchSubscription(userId: string): Promise<SubscriptionInfo | null> {
  // Return cached if fresh
  if (_cache.subscription && Date.now() - _cache.fetchedAt < CACHE_TTL) {
    return _cache.subscription;
  }
  // Deduplicate concurrent calls
  if (_cache.fetchPromise) return _cache.fetchPromise;

  _cache.fetchPromise = (async () => {
    try {
      // Fetch subscription + check if user is an invited doctor (gets PRO via owner's seat)
      const [subRes, invitedRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('status, plan, trial_end, remaining_starter_credits, quota_used, current_period_end, stripe_subscription_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc('is_invited_doctor', { _user_id: userId }),
      ]);

      const isInvitedDoctor = invitedRes.data === true;

      // Invited doctors get full PRO access without their own subscription
      if (isInvitedDoctor) {
        const info: SubscriptionInfo = {
          plan: 'PRO',
          status: 'ACTIVE',
          isActive: true,
          isPro: true,
          isTrial: false,
          remainingCredits: null,
          quotaUsed: 0,
          currentPeriodEnd: null,
          trialEnd: null,
        };
        _cache = { subscription: info, fetchedAt: Date.now(), fetchPromise: null };
        notifyListeners();
        return info;
      }

      const { data, error } = subRes;
      if (error || !data) {
        const fallback: SubscriptionInfo = {
          plan: 'STARTER', status: 'PENDING_CHECKOUT', isActive: false,
          isPro: false, isTrial: false, remainingCredits: 0, quotaUsed: 0,
          currentPeriodEnd: null, trialEnd: null,
        };
        _cache = { subscription: fallback, fetchedAt: Date.now(), fetchPromise: null };
        return fallback;
      }

      let currentStatus = data.status as SubscriptionStatus;
      if (currentStatus === 'TRIALING' && data.trial_end) {
        if (new Date() > new Date(data.trial_end)) currentStatus = 'EXPIRED';
      }

      const isActiveOrTrial = currentStatus === 'ACTIVE' || currentStatus === 'TRIALING';
      const info: SubscriptionInfo = {
        plan: data.plan as PlanType,
        status: currentStatus,
        isActive: isActiveOrTrial,
        isPro: data.plan === 'PRO' || data.plan === 'CLINIC',
        isTrial: currentStatus === 'TRIALING',
        remainingCredits: data.remaining_starter_credits,
        quotaUsed: data.quota_used || 0,
        currentPeriodEnd: data.current_period_end,
        trialEnd: data.trial_end,
      };

      _cache = { subscription: info, fetchedAt: Date.now(), fetchPromise: null };
      notifyListeners();
      return info;
    } catch {
      _cache.fetchPromise = null;
      return null;
    }
  })();

  return _cache.fetchPromise;
}

/**
 * Single hook that provides subscription + guard + quota data.
 * Replaces: useSubscription, useSubscriptionGuard, useQuota (partially).
 * All instances share one in-memory cache → one DB query per 30s max.
 */
export function useAppState() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(_cache.subscription);
  const [loading, setLoading] = useState(!_cache.subscription || Date.now() - _cache.fetchedAt > CACHE_TTL);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Subscribe to cache updates from other instances
  useEffect(() => {
    const listener = () => {
      if (mountedRef.current && _cache.subscription) {
        setSubscription(_cache.subscription);
        setLoading(false);
      }
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Use cache if available
    if (_cache.subscription && Date.now() - _cache.fetchedAt < CACHE_TTL) {
      setSubscription(_cache.subscription);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchSubscription(user.id).then(info => {
      if (!cancelled && mountedRef.current) {
        setSubscription(info);
        setLoading(false);
      }
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 5000);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [user, authLoading]);

  const refresh = useCallback(() => {
    if (!user) return;
    invalidateAppCache();
    fetchSubscription(user.id).then(info => {
      if (mountedRef.current) {
        setSubscription(info);
        setLoading(false);
      }
    });
  }, [user]);

  const isAllowed = subscription?.isActive ?? false;

  return {
    subscription,
    loading: loading || authLoading,
    isAllowed,
    refresh,
  };
}
