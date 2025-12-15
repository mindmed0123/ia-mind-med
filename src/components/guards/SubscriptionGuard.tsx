import { ReactNode } from 'react';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isAllowed, loading } = useSubscriptionGuard();

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

  // If not allowed, the hook will redirect automatically
  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
