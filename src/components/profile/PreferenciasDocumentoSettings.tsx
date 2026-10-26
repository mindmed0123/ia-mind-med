import { useEffect,useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_FORMAT,normalizeDocumentFormat } from '../../../supabase/functions/_shared/document-format';
import { Upload,Save } from 'lucide-react';

export function PreferenciasDocumentoSettings() {
  const { user } = useAuth(); const {toast} = useToast();
  const [value,setValue] = useState(DEFAULT_FORMAT); const [busy,setBusy]=useState(false);
  useEffect(() => { if(user) void supabase.from('preferencias_documento').select('*').eq('user_id',user.id).maybeSingle().then(({data}) => { if(data) setValue(normalizeDocumentFormat(data)); }); },[user]);
  const upload = async (file?: File) => {
    if (!file || !user) return;
    if (!['image/png','image/jpeg'].includes(file.type) || file.size>5*1024*1024) {toast({title:'Envie PNG ou JPG de até 5 MB',variant:'destructive'});return;}
    setBusy(true);
    try {const path=`${user.id}/letterhead-${crypto.randomUUID()}.${file.type==='image/png'?'png':'jpg'}`;const {error}=await supabase.storage.from('profile-images').upload(path,file);if(error) throw error; const {data}=supabase.storage.from('profile-images').getPublicUrl(path);setValue({...value,papel_timbrado:data.publicUrl});toast({title:'Papel timbrado enviado'});}catch{toast({title:'Não foi possível enviar',variant:'destructive'});}finally{setBusy(false);}
  };
  const save = async () => { if(!user)return;setBusy(true);try{const {error}=await supabase.from('preferencias_documento').upsert({user_id:user.id,...normalizeDocumentFormat(value),updated_at:new Date().toISOString()});if(error)throw error;toast({title:'Formatação salva'});}catch{toast({title:'Não foi possível salvar',variant:'destructive'});}finally{setBusy(false);} };
  return <section className="space-y-4 py-6 border-b border-border"><h2 className="text-lg font-semibold">Formatação dos documentos</h2>
    <div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="fonte-documento">Fonte</Label><Select value={value.fonte} onValueChange={fonte=>setValue({...value,fonte})}><SelectTrigger id="fonte-documento"><SelectValue/></SelectTrigger><SelectContent>{['Inter','Merriweather','Arial','Times New Roman'].map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
    {[['corpo','Corpo do texto (pt)',8,16],['margem_superior','Margem superior (mm)',25,50],['margem_inferior','Margem inferior (mm)',18,40],['margem_lateral','Margens laterais (mm)',10,35]].map(([key,label,min,max])=><div key={key} className="space-y-2"><Label htmlFor={String(key)}>{label}</Label><Input id={String(key)} type="number" min={min} max={max} value={value[key as keyof typeof value] as number} onChange={e=>setValue({...value,[key]:Number(e.target.value)})}/></div>)}</div>
    {([['cabecalho','Cabeçalho profissional'],['logo','Logo do perfil'],['rodape','Rodapé com registro de IA e hash']] as const).map(([key,label])=><div key={key} className="flex justify-between items-center"><Label htmlFor={key}>{label}</Label><Switch id={key} checked={value[key]} onCheckedChange={checked=>setValue({...value,[key]:checked})}/></div>)}
    <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><label><Upload className="w-4 h-4 mr-2"/>Papel timbrado<input className="hidden" type="file" accept="image/png,image/jpeg" onChange={e=>{void upload(e.target.files?.[0]);}}/></label></Button>{value.papel_timbrado&&<Button variant="ghost" onClick={()=>setValue({...value,papel_timbrado:null})}>Remover timbrado</Button>}<Button disabled={busy} onClick={()=>{void save();}}><Save className="w-4 h-4 mr-2"/>{busy?'Salvando…':'Salvar formatação'}</Button></div>
  </section>;
}