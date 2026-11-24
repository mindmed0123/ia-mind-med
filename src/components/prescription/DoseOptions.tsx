import { cn } from '@/lib/utils';

interface DoseOptionsProps {
  options: string[] | undefined;
  value: string;
  onPick: (dose: string) => void;
}

/** Doses disponíveis do remédio escolhido; um toque preenche o campo Dosagem. */
export function DoseOptions({ options, value, onPick }: DoseOptionsProps) {
  if (!options || options.length < 2) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Doses disponíveis:</span>
      {options.map((dose) => (
        <button
          key={dose}
          type="button"
          onClick={() => onPick(dose)}
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
            value.trim().toLowerCase() === dose.toLowerCase()
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background hover:border-primary/60 hover:bg-primary/5'
          )}
        >
          {dose}
        </button>
      ))}
    </div>
  );
}
