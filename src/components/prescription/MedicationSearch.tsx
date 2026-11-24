import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CheckCircle2, Pill, ShieldCheck, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAnvisaRegistro } from '@/lib/medication-fill';

export interface MedicationResult {
  id: string;
  nome_comercial: string;
  principio_ativo: string;
  laboratorio: string | null;
  apresentacao: string | null;
  concentracao: string | null;
  forma_farmaceutica: string | null;
  via_administracao: string | null;
  classe_terapeutica: string | null;
  registro_anvisa: string | null;
  tarja: string | null;
  tipo_receita: string | null;
  posologia_referencia: string | null;
  indicacoes: string | null;
  contraindicacoes: string | null;
  cid10_relacionados: string[] | null;
  is_parceiro: boolean;
  parceiro_nome: string | null;
  recomendado_cid?: boolean | null;
  anvisa_situacao?: string | null;
  anvisa_titular?: string | null;
  anvisa_verificado_em?: string | null;
}

interface MedicationSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (med: MedicationResult) => void;
  cid?: string | null;
  placeholder?: string;
  className?: string;
}

const tarjaLabel: Record<string, string> = {
  livre: 'MIP',
  vermelha: 'Tarja Vermelha',
  vermelha_retencao: 'Vermelha c/ Retenção',
  preta: 'Tarja Preta',
};

export function MedicationSearch({
  value,
  onChange,
  onSelect,
  cid = null,
  placeholder = 'Buscar medicamento (nome ou princípio ativo)',
  className,
}: MedicationSearchProps) {
  const [results, setResults] = useState<MedicationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_medications', {
          q: q || null,
          cid: cid || null,
        });
        if (error) throw error;
        setResults((data as MedicationResult[]) || []);
        setHighlight(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    },
    [cid]
  );

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // Ao abrir sem texto, a lista aparece na hora; enquanto digita, espera uma pausa.
    const delay = searched ? 250 : 0;
    if (!searched) setLoading(true);
    debounceRef.current = window.setTimeout(() => {
      runSearch(value.trim());
    }, delay);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open, runSearch]);

  // Close on click outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSelect = (med: MedicationResult) => {
    onSelect(med);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[highlight];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-label="Medicamento"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            aria-label="Ver lista de medicamentos"
            onClick={() => setOpen((o) => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>

      {open && (
        <div role="listbox" className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-96 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/80 backdrop-blur border-b border-border/60">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            {value.trim() ? 'Resultados do catálogo' : 'Catálogo de medicamentos'} · conferido com o registro da ANVISA
          </div>
          {results.length === 0 && (loading || !searched) && (
            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando a lista de medicamentos…
            </div>
          )}
          {results.length === 0 && !loading && searched && (
            <div className="p-3 text-sm text-muted-foreground">
              Nenhum medicamento do catálogo com esse nome. Você pode digitar o nome manualmente.
            </div>
          )}
          {results.map((med, idx) => (
            <button
              key={med.id}
              type="button"
              role="option"
              aria-selected={idx === highlight}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => handleSelect(med)}
              className={cn(
                'w-full text-left px-3 py-2 border-b last:border-b-0 border-border/50 transition-colors',
                idx === highlight ? 'bg-accent/40' : 'hover:bg-accent/20',
                med.is_parceiro && 'border-l-2 border-l-primary/70'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <Pill className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{med.nome_comercial}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {med.principio_ativo}
                      {med.concentracao ? ` · ${med.concentracao}` : ''}
                      {med.laboratorio ? ` · ${med.laboratorio}` : ''}
                    </div>
                    {(med.classe_terapeutica || med.registro_anvisa) && (
                      <div className="text-[11px] text-muted-foreground/80 truncate">
                        {med.classe_terapeutica}
                        {med.classe_terapeutica && med.registro_anvisa ? ' · ' : ''}
                        {med.registro_anvisa ? `Reg. ANVISA ${formatAnvisaRegistro(med.registro_anvisa)}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {med.recomendado_cid && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] gap-1"
                    >
                      Recomendado p/ CID
                    </Badge>
                  )}
                  {med.is_parceiro && (
                    <Badge
                      variant="secondary"
                      className="bg-gradient-to-r from-primary/15 to-accent/15 text-primary border border-primary/20 text-[10px] gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Recomendado
                    </Badge>
                  )}
                  {med.tarja && tarjaLabel[med.tarja] && (
                    <span className="text-[10px] text-muted-foreground">
                      {tarjaLabel[med.tarja]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
