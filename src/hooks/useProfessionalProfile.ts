import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Conselho } from '@/lib/professional-profile';

export interface ProfessionalProfile {
  conselho: Conselho | null;
  registro_numero: string | null;
  registro_uf: string | null;
  especialidade: string | null;
  especialidade_outra: string | null;
  perfil_completo_em: string | null;
}

export function useProfessionalProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('conselho, registro_numero, registro_uf, especialidade, especialidade_outra, perfil_completo_em')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      setProfile(data as ProfessionalProfile);
    } catch {
      // Falha de rede: não bloqueia o app — trata como perfil não respondido
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const isCRP = profile?.conselho === 'CRP';
  const isCRM = profile?.conselho === 'CRM';
  // Perfil respondido = tem data de conclusão. Null = ainda não respondeu.
  const needsProfile = !loading && !!user && !profile?.perfil_completo_em;

  return { profile, loading, isCRP, isCRM, needsProfile, refresh: load };
}
