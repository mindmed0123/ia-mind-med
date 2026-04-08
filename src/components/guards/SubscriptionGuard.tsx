import { ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';
import { Activity } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
  allowEmbedded?: boolean;
}

export function SubscriptionGuard({ children, allowEmbedded }: SubscriptionGuardProps) {
  const [searchParams] = useSearchParams();
  const hasBridge = !!searchParams.get('bridge');
  const isEmbedded = allowEmbedded && (searchParams.get('embedded') === 'true' || hasBridge);
  const { isAllowed, loading } = useSubscriptionGuard();
  const [showTimeout, setShowTimeout] = useState(false);

  // Skip guard in embedded mode
  if (isEmbedded) {
    return <>{children}</>;
  }

  // Safety: if loading takes too long, show a retry option
  useEffect(() => {
    if (!loading) {
      setShowTimeout(false);
      return;
    }
    const t = setTimeout(() => setShowTimeout(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

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
