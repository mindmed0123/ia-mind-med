import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useModelosLaudo, MODELOS_LAUDO, type ModeloLaudo } from '@/hooks/useModelosLaudo';
import { ModeloSelector } from '@/components/laudos/ModeloSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ModelosDocumentoSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const state = useModelosLaudo();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [base, setBase] = useState('padrao');
  const [fields, setFields] = useState<ModeloLaudo['secoes']>([]);
  const [saving, setSaving] = useState(false);
  if (state.loading || state.conselho === 'CRP') return null;
  const start = (row?: any) => {
    setEditing(row?.id || null); setNome(row?.nome || ''); setBase(row?.base || 'padrao');
    setFields(row?.secoes || MODELOS_LAUDO[0].secoes.map(s => ({ ...s })));
    setOpen(true);
  };
  const move = (i: number, delta: number) => {
    if (i + delta < 0 || i + delta >= fields.length) return;
    const next = [...fields]; [next[i],next[i+delta]] = [next[i+delta],next[i]]; setFields(next);
  };
  const save = async () => {
    if (!user || !nome.trim() || !fields.length || fields.some(s => !s.rotulo.trim())) return;
    setSaving(true);
    try {
      const payload = { user_id: user.id, nome: nome.trim(), base, inferencia: base === 'padrao', secoes: fields };
      const result = editing ? await supabase.from('modelos_laudo_usuario').update(payload).eq('id',editing).eq('user_id',user.id) : await supabase.from('modelos_laudo_usuario').insert(payload);
      if (result.error) throw result.error;
      await state.refresh(); setOpen(false); toast({ title: 'Modelo salvo' });
    } catch { toast({ title: 'Não foi possível salvar o modelo', variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const remove = async (row: any) => {
    if (!user || !window.confirm(`Excluir o modelo “${row.nome}”?`)) return;
    const result = await supabase.from('modelos_laudo_usuario').delete().eq('id',row.id).eq('user_id',user.id);
    if (result.error) { toast({ title: 'Não foi possível excluir', variant: 'destructive' }); return; }
    if (state.preference === row.id) await state.savePreference('padrao');
    await state.refresh(); toast({ title: 'Modelo excluído' });
  };
  return <section className="space-y-5 border-y border-border py-6">
    <h2 className="text-lg font-semibold">Modelos de laudo</h2>
    <ModeloSelector models={state.models} value={state.preference} error={state.error} onChange={id => { void state.savePreference(id).then(() => toast({ title:'Modelo padrão salvo' })).catch(() => toast({ title:'Não foi possível salvar',variant:'destructive' })); }} />
    <div className="flex items-center justify-between gap-3"><h3 className="font-medium">Personalizados</h3><Button variant="outline" onClick={() => start()}><Plus className="w-4 h-4 mr-2" />Criar modelo</Button></div>
    {state.rows.map(row => <div key={row.id} className="flex items-center justify-between gap-3 border-b border-border pb-3"><span className="min-w-0 break-words">{row.nome}</span><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Editar ${row.nome}`} title="Editar" onClick={() => start(row)}><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${row.nome}`} title="Excluir" onClick={() => { void remove(row); }}><Trash2 className="w-4 h-4" /></Button></div></div>)}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? 'Editar modelo' : 'Novo modelo personalizado'}</DialogTitle></DialogHeader>
      <Label htmlFor="nome-modelo">Nome do modelo</Label><Input id="nome-modelo" maxLength={100} value={nome} onChange={e => setNome(e.target.value)} />
      <Label htmlFor="base-modelo">Modelo de origem</Label><Select value={base} onValueChange={id => { setBase(id); setFields(MODELOS_LAUDO.find(m => m.id===id)?.secoes.map(s => ({...s})) || []); }}><SelectTrigger id="base-modelo"><SelectValue /></SelectTrigger><SelectContent>{MODELOS_LAUDO.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent></Select>
      <p className="text-sm text-muted-foreground">{base === 'padrao' ? 'Pode incluir conteúdo sugerido pelo sistema.' : 'Somente conteúdo ditado, sem inferência.'}</p>
      <div className="space-y-2">{fields.map((s,i) => <div key={s.chave} className="flex items-center gap-1"><Input aria-label={`Seção ${i+1}`} maxLength={150} value={s.rotulo} onChange={e => setFields(fields.map((f,j) => j===i ? {...f,rotulo:e.target.value} : f))} /><Button variant="ghost" size="icon" title="Mover para cima" aria-label={`Mover seção ${i+1} para cima`} disabled={i===0} onClick={() => move(i,-1)}><ArrowUp className="w-4 h-4" /></Button><Button variant="ghost" size="icon" title="Mover para baixo" aria-label={`Mover seção ${i+1} para baixo`} disabled={i===fields.length-1} onClick={() => move(i,1)}><ArrowDown className="w-4 h-4" /></Button><Button variant="ghost" size="icon" title="Remover seção" aria-label={`Remover seção ${i+1}`} onClick={() => setFields(fields.filter((_,j) => j!==i))}><Trash2 className="w-4 h-4" /></Button></div>)}</div>
      <Button variant="outline" disabled={fields.length>=30} onClick={() => setFields([...fields,{chave:`sec_${crypto.randomUUID().replace(/-/g,'')}`,rotulo:'Nova seção',descricao:''}])}><Plus className="w-4 h-4 mr-2" />Adicionar seção</Button>
      <Button onClick={() => { void save(); }} disabled={saving || !nome.trim() || !fields.length || fields.some(s => !s.rotulo.trim())}><Save className="w-4 h-4 mr-2" />{saving ? 'Salvando…' : 'Salvar modelo'}</Button>
    </DialogContent></Dialog>
  </section>;
}