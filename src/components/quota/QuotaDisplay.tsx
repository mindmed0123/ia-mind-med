import { useQuota } from '@/hooks/useQuota';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Zap, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export const QuotaDisplay = () => {
  const { quotaStatus, loading } = useQuota();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!quotaStatus?.hasSubscription) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Você não possui um plano ativo
            </p>
            <Button asChild>
              <a 
                href="https://pay.cakto.com.br/3bsu2vi_607441" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Assinar Agora
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quotaStatus.unlimited) {
    return (
      <Card className="border-primary bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold">Plano Pro</span>
                <Badge variant="default" className="ml-2">ILIMITADO</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Consultas ilimitadas com IA
              </p>
            </div>
            <Zap className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Plano Starter
  const remaining = quotaStatus.remaining ?? 0;
  const used = quotaStatus.used ?? 0;
  const total = quotaStatus.total ?? 10;
  const percentage = (used / total) * 100;
  const isLow = remaining <= 2;
  const isExhausted = remaining === 0;

  return (
    <Card className={isExhausted ? "border-destructive" : isLow ? "border-warning" : ""}>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Plano Starter</span>
              <Badge variant={isExhausted ? "destructive" : "secondary"}>
                {remaining}/{total} consultas
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isExhausted ? 'Limite atingido' : `${remaining} consultas restantes`}
            </p>
          </div>
          <TrendingUp className={`h-6 w-6 ${isExhausted ? 'text-destructive' : 'text-primary'}`} />
        </div>

        <div className="space-y-2">
          <Progress 
            value={percentage} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground text-right">
            {used} de {total} utilizadas ({Math.round(percentage)}%)
          </p>
        </div>

        {(isLow || isExhausted) && (
          <div className="pt-2 space-y-2">
            <p className="text-sm font-medium">
              {isExhausted ? '🚀 Faça upgrade para continuar' : '⚠️ Suas consultas estão acabando'}
            </p>
            <Button 
              variant={isExhausted ? "default" : "outline"} 
              size="sm" 
              className="w-full"
              asChild
            >
              <a 
                href="https://pay.cakto.com.br/u95r4cv_607505" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade para Pro (Ilimitado)
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
