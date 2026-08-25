import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VagasFundador {
  totais: number;
  ocupadas: number;
  restantes: number;
}

/** Contador real de vagas do plano Fundador. */
export function useVagasFundador() {
  const query = useQuery({
    queryKey: ['fundador-vagas'],
    staleTime: 60_000,
    queryFn: async (): Promise<VagasFundador> => {
      const { data, error } = await supabase.rpc('fundador_vagas' as any);
      if (error) throw error;
      const row = (data ?? {}) as { totais?: number; ocupadas?: number };
      const totais = Number(row.totais ?? 100);
      const ocupadas = Number(row.ocupadas ?? 0);
      return { totais, ocupadas, restantes: Math.max(0, totais - ocupadas) };
    },
  });

  return {
    ...query,
    totais: query.data?.totais ?? 100,
    ocupadas: query.data?.ocupadas ?? 0,
    // Enquanto carrega, assume que há vagas para não esconder o plano por engano.
    restantes: query.data ? query.data.restantes : 100,
  };
}
