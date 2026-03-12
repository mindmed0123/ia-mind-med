import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SpecialtyTemplate {
  id: string;
  specialty: string;
  display_name: string;
  sections: { key: string; label: string; order: number }[];
  is_default: boolean;
}

export function useSpecialtyTemplates() {
  const [templates, setTemplates] = useState<SpecialtyTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('specialty_templates')
        .select('id, specialty, display_name, sections, is_default')
        .order('display_name');

      if (!error && data) {
        setTemplates(data.map((t: any) => ({
          ...t,
          sections: t.sections || [],
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  return { templates, loading };
}
