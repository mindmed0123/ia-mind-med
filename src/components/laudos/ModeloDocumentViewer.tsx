import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { buildCleanLaudoText } from '@/lib/laudo-clean-text';

export function ModeloDocumentViewer({ laudo, onCopy }: { laudo: any; onCopy: (text: string) => void }) {
  const s = laudo.sections;
  return <article className="space-y-6 py-4">
    <div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold break-words">{s.modelo_nome}</h2><Button size="sm" variant="outline" onClick={() => onCopy(buildCleanLaudoText(laudo))}><Copy className="w-4 h-4 mr-2" />Copiar</Button></div>
    {s.modelo_secoes_def.map((f: any,i: number) => <section key={f.chave} className="border-b border-border pb-4"><h3 className="font-semibold mb-2">{i+1}. {f.rotulo}</h3><p className="whitespace-pre-wrap break-words min-h-6">{s.modelo_campos[f.chave] || ''}</p></section>)}
    <p className="text-xs text-muted-foreground">{laudo.legal_disclaimer}</p>
  </article>;
}