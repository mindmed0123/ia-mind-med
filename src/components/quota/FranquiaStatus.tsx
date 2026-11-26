import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type Uso = { assinante: boolean; franquia_total: number; franquia_usada: number; franquia_restante: number };

export const fetchFranquia = async (): Promise<Uso | null> => {
  const { data } = await supabase.rpc('free_usage');
  return (data as unknown as Uso) ?? null;
};

/** Contador discreto da franquia gratuita, lido do servidor. */
export const FranquiaStatus = () => {
  const [uso, setUso] = useState<Uso | null>(null);
  useEffect(() => { fetchFranquia().then(setUso).catch(() => {}); }, []);
  if (!uso || uso.assinante) return null;
  const usada = Math.min(uso.franquia_usada, uso.franquia_total);
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      {usada} de {uso.franquia_total} consultas gratuitas utilizadas
      {uso.franquia_restante === 0 && (
        <> · <Link to="/medicos/assinatura-expirada?motivo=limite" className="underline underline-offset-2">ver planos</Link></>
      )}
    </p>
  );
};
