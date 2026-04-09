/**
 * Legacy compatibility wrapper – now delegates to useAppState
 * to avoid duplicate DB queries.
 */
import { useAppState, type SubscriptionInfo, type PlanType, type SubscriptionStatus } from './useAppState';

export type { PlanType, SubscriptionStatus, SubscriptionInfo };

export function useSubscription() {
  const { subscription, loading, refresh } = useAppState();
  return { subscription, loading, refreshSubscription: refresh };
}
