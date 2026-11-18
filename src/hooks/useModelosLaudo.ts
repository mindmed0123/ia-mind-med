import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MODELOS_LAUDO, customModelo, type ModeloLaudo } from '../../supabase/functions/_shared/modelos-laudo';
import { aplicarRestricaoParceiro, somenteDocumentacao as parceiroSomenteDocumentacao, MODELO_DOCUMENTACAO_PARCEIRO } from '../../supabase/functions/_shared/parceiro-restricoes';

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
  const [parceiroSlug, setParceiroSlug] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [p, models, membership] = await Promise.all([
        supabase.from('profiles').select('modelo_padrao_id, conselho, parceiro_slug').eq('id',user.id).single(),
        supabase.from('modelos_laudo_usuario').select('*').eq('user_id',user.id).order('created_at'),
        supabase.from('organization_members').select('organization_id').eq('user_id',user.id).eq('is_active',true).order('created_at').limit(1).maybeSingle(),
      ]);
      if (p.error || models.error || membership.error) throw new Error('Não foi possível carregar os modelos.');
      setConselho(p.data?.conselho || null);
      const slug = p.data?.parceiro_slug || null;
      setParceiroSlug(slug);
      // Mesma regra do servidor: conta restrita nunca vê modelo com inferência.
      const restringir = (m: ModeloLaudo) => aplicarRestricaoParceiro(m, slug);
      setRows(models.data || []);
      setCustom((models.data || []).map(customModelo).map(restringir));
      let org: { modelo_padrao_id: string | null; modelo_padrao_travado: boolean } | null = null;
      if (membership.data) {
        const result = await supabase.from('organizations').select('modelo_padrao_id, modelo_padrao_travado').eq('id',membership.data.organization_id).single();
        if (result.error) throw result.error;
        org = result.data;
      }
      const personal = (models.data || []).map(customModelo).map(restringir);
      if (org?.modelo_padrao_id && !MODELOS_LAUDO.some(m => m.id === org.modelo_padrao_id) && !personal.some(m => m.id === org.modelo_padrao_id)) {
        const result = await supabase.from('modelos_laudo_usuario').select('*').eq('id',org.modelo_padrao_id).maybeSingle();
        if (result.error || !result.data) throw new Error('Modelo da organização indisponível');
        setCustom([...personal, restringir(customModelo(result.data))]);
      }
      const restrito = parceiroSomenteDocumentacao(slug);
      const semCompleto = (id: string) => restrito && id === 'padrao' ? MODELO_DOCUMENTACAO_PARCEIRO : id;
      const pref = semCompleto(p.data?.modelo_padrao_id || 'padrao');
      setPreference(pref);
      setSelected(semCompleto(org?.modelo_padrao_id || pref));
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
  const somenteDocumentacao = parceiroSomenteDocumentacao(parceiroSlug);
  const bases = somenteDocumentacao ? MODELOS_LAUDO.filter(m => !m.inferencia) : MODELOS_LAUDO;
  return { models: [...bases, ...custom], bases, somenteDocumentacao, parceiroSlug, rows, selected, setSelected, preference, savePreference, locked, loading, error, conselho, refresh };
}