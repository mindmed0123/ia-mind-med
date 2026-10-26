import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ModeloLaudo } from '@/hooks/useModelosLaudo';

export function ModeloSelector({ models, value, onChange, disabled, error }: { models: ModeloLaudo[]; value: string; onChange: (value: string) => void; disabled?: boolean; error?: string | null }) {
  const selected = models.find(m => m.id === value);
  return <div className="space-y-2 min-w-0">
    <Label htmlFor="modelo-laudo">Modelo do laudo</Label>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id="modelo-laudo" className="h-auto min-h-10 text-left [&>span]:whitespace-normal"><SelectValue placeholder="Modelo da organização" /></SelectTrigger>
      <SelectContent>{models.map(m => <SelectItem value={m.id} key={m.id}><span className="block whitespace-normal">{m.nome}</span></SelectItem>)}</SelectContent>
    </Select>
    {selected && <p className="text-xs text-muted-foreground">{selected.descricao}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}