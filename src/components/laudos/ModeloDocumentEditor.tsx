import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, CheckCircle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AVISO_INFERENCIA } from '../../../supabase/functions/_shared/modelos-laudo';

export function ModeloDocumentEditor({ laudoId, initialData, onStatusChange }: { laudoId: string; initialData: any; onStatusChange?: (status: string) => void }) {
  const [fields,setFields] = useState<Record<string,string>>(initialData.sections.modelo_campos);
  const [busy,setBusy] = useState(false);
  const { toast } = useToast();
  const save = async (finalize = false) => {
    setBusy(true);
    try {
      const { data: current,error: loadError } = await supabase.from('laudos').select('sections').eq('id',laudoId).single();
      if (loadError) throw loadError;
      const sections = { ...(current?.sections as any), modelo_campos: fields };
      const markdown = initialData.sections.modelo_secoes_def.map((f: any) => `## ${f.rotulo}\n\n${fields[f.chave] || ''}`).join('\n\n');
      const { error } = await supabase.from('laudos').update({ sections, report_markdown: markdown, editor_last_saved: new Date().toISOString(), ...(finalize ? {status:'completed',finalized_at:new Date().toISOString()} : {}) }).eq('id',laudoId);
      if (error) throw error;
      if (finalize) onStatusChange?.('completed');
      toast({title: finalize ? 'Documento concluído' : 'Documento salvo'});
      return true;
    } catch { toast({title:'Não foi possível salvar',variant:'destructive'}); return false; }
    finally { setBusy(false); }
  };
  const exportPdf = async () => {
    if (!await save()) return;
    try {
      const {data,error} = await supabase.functions.invoke('export-pdf',{body:{laudo_id:laudoId}});
      if (error) throw error;
      const {generatePdf,downloadPdf} = await import('@/lib/pdf-generator');
      const blob = await generatePdf({html:data.html,fileName:data.fileName,verifyUrl:`${window.location.origin}/api/verify-pdf/${laudoId}?token=${data.verifyToken}`,pdfMeta:data.pdfMeta});
      downloadPdf(blob,data.fileName);
    } catch { toast({title:'Não foi possível exportar',variant:'destructive'}); }
  };
  return <section className="space-y-5">
    <h2 className="text-xl font-semibold">{initialData.sections.modelo_nome}</h2>
    {initialData.sections.inferencia && <p role="alert" className="border-l-4 border-primary bg-primary/5 p-4 text-sm">{AVISO_INFERENCIA}</p>}
    {initialData.sections.modelo_secoes_def.map((f: any) => <div className="space-y-2" key={f.chave}><Label htmlFor={`campo-${f.chave}`}>{f.rotulo}</Label><Textarea id={`campo-${f.chave}`} rows={4} value={fields[f.chave] || ''} onChange={e => setFields({...fields,[f.chave]:e.target.value})} /></div>)}
    <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => {void save();}}><Save className="w-4 h-4 mr-2" />Salvar</Button><Button disabled={busy} onClick={() => {void save(true);}}><CheckCircle className="w-4 h-4 mr-2" />Concluir documento</Button><Button variant="outline" disabled={busy} onClick={() => {void exportPdf();}}><Download className="w-4 h-4 mr-2" />PDF</Button></div>
  </section>;
}