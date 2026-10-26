import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MODELOS_LAUDO, customModelo, type ModeloLaudo } from '../../supabase/functions/_shared/modelos-laudo';

export { MODELOS_LAUDO };
export type { ModeloLaudo };
export function useModelosLaudo() {
  const { user } = useAuth();
  const [custom, setCustom] = useState<ModeloLaudo[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState('padrao');
  const [preference, setPreference] = useState('padrao');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conselho, setConselho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [p, models, membership] = await Promise.all([
        supabase.from('profiles').select('modelo_padrao_id, conselho').eq('id',user.id).single(),
        supabase.from('modelos_laudo_usuario').select('*').eq('user_id',user.id).order('created_at'),
        supabase.from('organization_members').select('organization_id').eq('user_id',user.id).eq('is_active',true).order('created_at').limit(1).maybeSingle(),
      ]);
      if (p.error || models.error || membership.error) throw new Error('Não foi possível carregar os modelos.');
      setConselho(p.data?.conselho || null);
      setRows(models.data || []);
      setCustom((models.data || []).map(customModelo));
      let org: { modelo_padrao_id: string | null; modelo_padrao_travado: boolean } | null = null;
      if (membership.data) {
        const result = await supabase.from('organizations').select('modelo_padrao_id, modelo_padrao_travado').eq('id',membership.data.organization_id).single();
        if (result.error) throw result.error;
        org = result.data;
      }
      const pref = p.data?.modelo_padrao_id || 'padrao';
      setPreference(pref);
      setSelected(org?.modelo_padrao_id || pref);
      setLocked(!!org?.modelo_padrao_id && !!org.modelo_padrao_travado);
    } catch { setError('Não foi possível carregar os modelos.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);
  const savePreference = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ modelo_padrao_id: id }).eq('id',user.id);
    if (error) throw error;
    setPreference(id);
  };
  return { models: [...MODELOS_LAUDO, ...custom], rows, selected, setSelected, preference, savePreference, locked, loading, error, conselho, refresh };
}