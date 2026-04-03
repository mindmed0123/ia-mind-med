import { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

interface SubscriptionGuardProps {
  children: ReactNode;
  allowEmbedded?: boolean;
}

export function SubscriptionGuard({ children, allowEmbedded }: SubscriptionGuardProps) {
  const [searchParams] = useSearchParams();
  const hasBridge = !!searchParams.get('bridge');
  const isEmbedded = allowEmbedded && (searchParams.get('embedded') === 'true' || hasBridge);
  const { isAllowed, loading } = useSubscriptionGuard();

  // Skip guard in embedded mode (auth handled by bridge token)
  if (isEmbedded) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-muted-foreground">Verificando assinatura...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
