/**
 * Legacy compatibility wrapper – now delegates to useAppState.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, invalidateAppCache } from './useAppState';
import { useAuth } from '@/contexts/AuthContext';

export function useSubscriptionGuard() {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading, isAllowed } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !authLoading && user && !isAllowed) {
      navigate('/medicos/assinatura-expirada', { replace: true });
    }
  }, [loading, authLoading, user, isAllowed, navigate]);

  return {
    isAllowed,
    status: subscription?.status ?? null,
    loading: loading || authLoading,
    plan: subscription?.plan ?? null,
    trialEnd: subscription?.trialEnd ?? null,
  };
}

export { invalidateAppCache as invalidateSubscriptionCache };
