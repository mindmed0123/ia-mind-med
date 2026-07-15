import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2, Building2 } from 'lucide-react';

interface Farmaceutica {
  id: string;
  nome: string;
  email_farmacovigilancia: string;
  telefone: string | null;
  ativo: boolean;
}

export function AdminFarmaceuticasTab() {
  const [rows, setRows] = useState<Farmaceutica[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Farmaceutica> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('farmaceuticas').select('*').order('nome');
    if (error) toast.error('Falha ao carregar');
    setRows((data as Farmaceutica[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.nome || !editing?.email_farmacovigilancia) { toast.error('Nome e e-mail obrigatórios'); return; }
    setSaving(true);
    const payload = {
      nome: editing.nome,
      email_farmacovigilancia: editing.email_farmacovigilancia,
      telefone: editing.telefone ?? null,
      ativo: editing.ativo ?? true,
    };
    const { error } = editing.id
      ? await supabase.from('farmaceuticas').update(payload).eq('id', editing.id)
      : await supabase.from('farmaceuticas').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Salvo');
    setEditing(null); load();
  };

  const toggle = async (r: Farmaceutica) => {
    const { error } = await supabase.from('farmaceuticas').update({ ativo: !r.ativo }).eq('id', r.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (r: Farmaceutica) => {
    if (!confirm(`Remover ${r.nome}?`)) return;
    const { error } = await supabase.from('farmaceuticas').delete().eq('id', r.id);
    if (error) toast.error(error.message); else { toast.success('Removida'); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Farmacêuticas — Farmacovigilância</CardTitle>
        <Button size="sm" onClick={() => setEditing({ ativo: true })}><Plus className="w-4 h-4 mr-1" />Nova</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-3">Nome</th><th className="p-3">E-mail farmacovigilância</th><th className="p-3">Telefone</th><th className="p-3">Ativa</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.nome}</td>
                    <td className="p-3 text-muted-foreground">{r.email_farmacovigilancia}</td>
                    <td className="p-3 text-muted-foreground">{r.telefone ?? '—'}</td>
                    <td className="p-3"><Switch checked={r.ativo} onCheckedChange={() => toggle(r)} /></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma farmacêutica cadastrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar farmacêutica' : 'Nova farmacêutica'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editing?.nome ?? ''} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></div>
            <div><Label>E-mail farmacovigilância *</Label><Input type="email" value={editing?.email_farmacovigilancia ?? ''} onChange={(e) => setEditing({ ...editing, email_farmacovigilancia: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={editing?.telefone ?? ''} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} /></div>
            <label className="flex items-center gap-2"><Switch checked={editing?.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} /> Ativa</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
