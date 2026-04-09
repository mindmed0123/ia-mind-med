import { ReactNode, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppState } from '@/hooks/useAppState';
import { useAuth } from '@/contexts/AuthContext';
import { Activity } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
  allowEmbedded?: boolean;
}

export function SubscriptionGuard({ children, allowEmbedded }: SubscriptionGuardProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasBridge = !!searchParams.get('bridge');
  const isEmbedded = allowEmbedded && (searchParams.get('embedded') === 'true' || hasBridge);
  const { user, loading: authLoading } = useAuth();
  const { isAllowed, loading } = useAppState();
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    if (!loading || isEmbedded) {
      setShowTimeout(false);
      return;
    }
    const t = setTimeout(() => setShowTimeout(true), 4000);
    return () => clearTimeout(t);
  }, [loading, isEmbedded]);

  // Redirect if not allowed
  useEffect(() => {
    if (!loading && !authLoading && user && !isAllowed && !isEmbedded) {
      navigate('/medicos/assinatura-expirada', { replace: true });
    }
  }, [loading, authLoading, user, isAllowed, isEmbedded, navigate]);

  if (isEmbedded) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
          {showTimeout && (
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-primary underline hover:opacity-80"
            >
              Recarregar página
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
