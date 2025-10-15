import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface QuotaStatus {
  hasSubscription: boolean;
  plan: 'starter' | 'pro' | null;
  remaining: number | null;
  used?: number;
  total?: number;
  unlimited: boolean;
  status?: string;
}

export const useQuota = () => {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchQuotaStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setQuotaStatus({
          hasSubscription: false,
          plan: null,
          remaining: 0,
          unlimited: false
        });
        return;
      }

      const { data, error } = await supabase.rpc('get_quota_status', {
        p_user_id: user.id
      });

      if (error) throw error;

      const result = data as any;

      setQuotaStatus({
        hasSubscription: result.has_subscription,
        plan: result.plan,
        remaining: result.remaining,
        used: result.used,
        total: result.total,
        unlimited: result.unlimited,
        status: result.status
      });
    } catch (error) {
      console.error('Erro ao buscar status de quota:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar informações do plano.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const consumeQuota = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc('check_and_consume_quota', {
        p_user_id: user.id
      });

      if (error) throw error;

      const result = data as any;

      if (!result.allowed) {
        if (result.reason === 'quota_exceeded') {
          toast({
            title: 'Limite atingido',
            description: 'Você atingiu o limite de 10 consultas do plano Starter. Faça upgrade para o plano Pro (ilimitado)!',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Acesso negado',
            description: 'Você precisa de uma assinatura ativa para usar este recurso.',
            variant: 'destructive'
          });
        }
        return false;
      }

      // Atualizar status local
      await fetchQuotaStatus();
      return true;
    } catch (error) {
      console.error('Erro ao consumir quota:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar a operação.',
        variant: 'destructive'
      });
      return false;
    }
  };

  useEffect(() => {
    fetchQuotaStatus();
  }, []);

  return {
    quotaStatus,
    loading,
    refreshQuota: fetchQuotaStatus,
    consumeQuota
  };
};
