import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, ShieldAlert, Loader2, Plus, Trash2, CheckCircle2, FileText,
} from 'lucide-react';
import {
  VIAS_ADMINISTRACAO, TIPOS_NOTIFICACAO, RECUPERACAO_OPCOES, CRITERIOS_GRAVIDADE, STEPS,
} from '@/lib/farmacovigilancia-constants';
import type { FarmacovigilanciaPrefill } from '@/components/farmacovigilancia/FarmacovigilanciaButton';

// ---------- Schema ----------
const doencaSchema = z.object({
  nome: z.string().min(1, 'Informe a doença'),
  data_diagnostico: z.string().optional().or(z.literal('')),
});
const medicamentoSchema = z.object({
  nome: z.string().min(1, 'Informe o medicamento'),
  indicacao: z.string().optional().or(z.literal('')),
  data_inicio: z.string().optional().or(z.literal('')),
  data_termino: z.string().optional().or(z.literal('')),
  dose_diaria: z.string().optional().or(z.literal('')),
});
const outroEventoSchema = z.object({
  evento: z.string().min(1),
  data_inicio: z.string().optional().or(z.literal('')),
  continua: z.enum(['Sim', 'Não']).optional(),
  data_termino: z.string().optional().or(z.literal('')),
});

const schema = z.object({
  relator: z.object({
    nome: z.string().min(3, 'Informe o nome'),
    email: z.string().email('E-mail inválido'),
    telefone: z.string().optional().or(z.literal('')),
    profissao: z.string().min(1, 'Informe a profissão'),
    crm: z.string().min(1, 'Informe o CRM'),
    uf: z.string().optional().or(z.literal('')),
    vinculo_instituicao: z.enum(['Sim', 'Não']),
    instituicao_nome: z.string().optional().or(z.literal('')),
  }),
  paciente: z.object({
    identificacao: z.string().optional().or(z.literal('')),
    sexo: z.enum(['Masculino', 'Feminino', 'Não informado']),
    gestante: z.enum(['Sim', 'Não', 'Não sabe']).optional(),
    dum: z.string().optional().or(z.literal('')),
    semanas_gestacionais: z.string().optional().or(z.literal('')),
    data_nascimento: z.string().optional().or(z.literal('')),
    peso: z.string().optional().or(z.literal('')),
    altura: z.string().optional().or(z.literal('')),
  }),
  produto: z.object({
    farmaceutica_id: z.string().uuid('Selecione a farmacêutica'),
    produto: z.string().min(2, 'Informe o produto'),
    lote_numero: z.string().optional().or(z.literal('')),
    lote_validade: z.string().optional().or(z.literal('')),
    indicacao: z.string().optional().or(z.literal('')),
    via: z.string().optional().or(z.literal('')),
    posologia: z.string().optional().or(z.literal('')),
    data_inicio: z.string().optional().or(z.literal('')),
    data_termino: z.string().optional().or(z.literal('')),
    em_uso: z.boolean().optional(),
  }),
  historico: z.object({
    tem_doencas: z.enum(['Sim', 'Não']),
    doencas: z.array(doencaSchema).optional(),
    usa_outros_meds: z.enum(['Sim', 'Não']),
    outros_meds: z.array(medicamentoSchema).optional(),
  }),
  evento: z.object({
    descricao: z.string().min(20, 'Descrição deve ter ao menos 20 caracteres'),
    eventos: z.string().min(2, 'Liste os eventos adversos'),
    tipo_notificacao: z.string().min(1, 'Selecione o tipo'),
    causa: z.string().min(1, 'Informe a possível causa'),
    data_inicio: z.string().min(1, 'Informe a data de início'),
    recuperou: z.enum(RECUPERACAO_OPCOES as any),
    data_recuperacao: z.string().optional().or(z.literal('')),
    tratado: z.enum(['Sim', 'Não']),
    tratamento_desc: z.string().optional().or(z.literal('')),
    outros_eventos_tem: z.enum(['Sim', 'Não']),
    outros_eventos: z.array(outroEventoSchema).optional(),
    suspendeu: z.enum(['Sim', 'Não']),
    gravidade: z.enum(['Não grave', 'Grave']),
    criterios_gravidade: z.array(z.string()).optional(),
  }),
  consentimento: z.literal(true, { errorMap: () => ({ message: 'Consentimento obrigatório' }) }),
});

export type FarmacoForm = z.infer<typeof schema>;

// ---------- Stepper ----------
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto">
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center flex-1 min-w-fit">
            <div className={`flex items-center gap-2 ${active ? 'text-primary font-semibold' : done ? 'text-primary/70' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${active ? 'bg-primary text-primary-foreground border-primary' : done ? 'bg-primary/10 border-primary/50 text-primary' : 'border-muted-foreground/30'}`}>
                {done ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <span className="text-xs hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${done ? 'bg-primary/50' : 'bg-muted'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Steps ----------
function FieldError({ name }: { name: string }) {
  const { formState: { errors } } = useFormContext();
  const err = name.split('.').reduce<any>((a, k) => a?.[k], errors);
  if (!err?.message) return null;
  return <p className="text-xs text-destructive mt-1">{String(err.message)}</p>;
}

function Step1() {
  const { register, watch } = useFormContext<FarmacoForm>();
  const vinculo = watch('relator.vinculo_instituicao');
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Nome *</Label><Input {...register('relator.nome')} /><FieldError name="relator.nome" /></div>
        <div><Label>E-mail *</Label><Input type="email" {...register('relator.email')} /><FieldError name="relator.email" /></div>
        <div><Label>Telefone</Label><Input {...register('relator.telefone')} /></div>
        <div><Label>Profissão *</Label><Input {...register('relator.profissao')} /><FieldError name="relator.profissao" /></div>
        <div><Label>CRM *</Label><Input {...register('relator.crm')} /><FieldError name="relator.crm" /></div>
        <div><Label>UF</Label><Input maxLength={2} {...register('relator.uf')} /></div>
      </div>
      <div>
        <Label>Vinculado a instituição de saúde/hospital?</Label>
        <RadioGroup className="flex gap-6 mt-2" value={vinculo} onValueChange={(v) => (document.querySelector('input[name="relator.vinculo_instituicao"]') as HTMLInputElement)?.dispatchEvent(new Event('change'))}>
          <label className="flex items-center gap-2"><input type="radio" value="Sim" {...register('relator.vinculo_instituicao')} /> Sim</label>
          <label className="flex items-center gap-2"><input type="radio" value="Não" {...register('relator.vinculo_instituicao')} /> Não</label>
        </RadioGroup>
      </div>
      {vinculo === 'Sim' && (
        <div><Label>Qual instituição?</Label><Input {...register('relator.instituicao_nome')} /></div>
      )}
    </div>
  );
}

function Step2() {
  const { register, watch } = useFormContext<FarmacoForm>();
  const sexo = watch('paciente.sexo');
  const gestante = watch('paciente.gestante');
  return (
    <div className="space-y-4">
      <div><Label>Iniciais ou nome</Label><Input {...register('paciente.identificacao')} /></div>
      <div>
        <Label>Sexo</Label>
        <div className="flex gap-4 mt-2">
          {['Masculino', 'Feminino', 'Não informado'].map((s) => (
            <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('paciente.sexo')} /> {s}</label>
          ))}
        </div>
      </div>
      {sexo === 'Feminino' && (
        <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
          <Label>É gestante?</Label>
          <div className="flex gap-4">
            {['Sim', 'Não', 'Não sabe'].map((s) => (
              <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('paciente.gestante')} /> {s}</label>
            ))}
          </div>
          {gestante === 'Sim' && (
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Última menstruação (DUM)</Label><Input type="date" {...register('paciente.dum')} /></div>
              <div><Label>Semanas gestacionais</Label><Input type="number" {...register('paciente.semanas_gestacionais')} /></div>
            </div>
          )}
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-4">
        <div><Label>Data de nascimento</Label><Input type="date" {...register('paciente.data_nascimento')} /></div>
        <div><Label>Peso (kg)</Label><Input type="number" step="0.1" {...register('paciente.peso')} /></div>
        <div><Label>Altura (cm)</Label><Input type="number" {...register('paciente.altura')} /></div>
      </div>
    </div>
  );
}

function Step3({ farmaceuticas }: { farmaceuticas: { id: string; nome: string }[] }) {
  const { register, watch, setValue } = useFormContext<FarmacoForm>();
  const emUso = watch('produto.em_uso');
  const farmId = watch('produto.farmaceutica_id');
  const via = watch('produto.via');
  return (
    <div className="space-y-4">
      <div>
        <Label>Farmacêutica responsável *</Label>
        <Select value={farmId || ''} onValueChange={(v) => setValue('produto.farmaceutica_id', v, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Selecione a farmacêutica" /></SelectTrigger>
          <SelectContent>
            {farmaceuticas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldError name="produto.farmaceutica_id" />
      </div>
      <div><Label>Produto (nome, apresentação, dose) *</Label><Input {...register('produto.produto')} /><FieldError name="produto.produto" /></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Lote — número</Label><Input {...register('produto.lote_numero')} /></div>
        <div><Label>Lote — validade</Label><Input type="date" {...register('produto.lote_validade')} /></div>
      </div>
      <div><Label>Motivo de uso (indicação)</Label><Input {...register('produto.indicacao')} /></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Via de administração</Label>
          <Select value={via || ''} onValueChange={(v) => setValue('produto.via', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{VIAS_ADMINISTRACAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Posologia</Label><Input placeholder="Ex: 1 comp. 8/8h" {...register('produto.posologia')} /></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Início do tratamento</Label><Input type="date" {...register('produto.data_inicio')} /></div>
        <div>
          <Label>Término do tratamento</Label>
          <Input type="date" disabled={emUso} {...register('produto.data_termino')} />
          <label className="flex items-center gap-2 mt-2 text-sm">
            <Checkbox checked={emUso} onCheckedChange={(v) => setValue('produto.em_uso', !!v)} /> Em uso
          </label>
        </div>
      </div>
    </div>
  );
}

function Step4() {
  const { register, control, watch } = useFormContext<FarmacoForm>();
  const temDoencas = watch('historico.tem_doencas');
  const usaMeds = watch('historico.usa_outros_meds');
  const doencas = useFieldArray({ control, name: 'historico.doencas' });
  const meds = useFieldArray({ control, name: 'historico.outros_meds' });
  return (
    <div className="space-y-6">
      <div>
        <Label>Paciente possui alguma doença?</Label>
        <div className="flex gap-4 mt-2">
          {['Sim', 'Não'].map((s) => <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('historico.tem_doencas')} /> {s}</label>)}
        </div>
        {temDoencas === 'Sim' && (
          <div className="space-y-3 mt-3">
            {doencas.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2 items-end">
                <div className="flex-1"><Label className="text-xs">Doença</Label><Input {...register(`historico.doencas.${i}.nome`)} /></div>
                <div className="flex-1"><Label className="text-xs">Diagnóstico</Label><Input type="date" {...register(`historico.doencas.${i}.data_diagnostico`)} /></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => doencas.remove(i)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => doencas.append({ nome: '', data_diagnostico: '' })}><Plus className="w-4 h-4 mr-1" />Adicionar doença</Button>
          </div>
        )}
      </div>
      <div>
        <Label>Paciente usa outros medicamentos?</Label>
        <div className="flex gap-4 mt-2">
          {['Sim', 'Não'].map((s) => <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('historico.usa_outros_meds')} /> {s}</label>)}
        </div>
        {usaMeds === 'Sim' && (
          <div className="space-y-3 mt-3">
            {meds.fields.map((f, i) => (
              <div key={f.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="grid md:grid-cols-2 gap-2">
                  <div><Label className="text-xs">Medicamento</Label><Input {...register(`historico.outros_meds.${i}.nome`)} /></div>
                  <div><Label className="text-xs">Indicação</Label><Input {...register(`historico.outros_meds.${i}.indicacao`)} /></div>
                  <div><Label className="text-xs">Início</Label><Input type="date" {...register(`historico.outros_meds.${i}.data_inicio`)} /></div>
                  <div><Label className="text-xs">Término</Label><Input type="date" {...register(`historico.outros_meds.${i}.data_termino`)} /></div>
                  <div className="md:col-span-2"><Label className="text-xs">Dose diária</Label><Input {...register(`historico.outros_meds.${i}.dose_diaria`)} /></div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => meds.remove(i)}><Trash2 className="w-4 h-4 mr-1" />Remover</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => meds.append({ nome: '', indicacao: '', data_inicio: '', data_termino: '', dose_diaria: '' })}><Plus className="w-4 h-4 mr-1" />Adicionar medicamento</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Step5() {
  const { register, control, watch, setValue } = useFormContext<FarmacoForm>();
  const recuperou = watch('evento.recuperou');
  const tratado = watch('evento.tratado');
  const outros = watch('evento.outros_eventos_tem');
  const gravidade = watch('evento.gravidade');
  const tipo = watch('evento.tipo_notificacao');
  const criterios = watch('evento.criterios_gravidade') || [];
  const outrosEventos = useFieldArray({ control, name: 'evento.outros_eventos' });
  return (
    <div className="space-y-4">
      <div><Label>Descrição do ocorrido *</Label><Textarea rows={4} {...register('evento.descricao')} /><FieldError name="evento.descricao" /></div>
      <div><Label>Evento(s) adverso(s) *</Label><Input placeholder="Ex: náusea, urticária" {...register('evento.eventos')} /><FieldError name="evento.eventos" /></div>
      <div>
        <Label>Tipo de notificação *</Label>
        <Select value={tipo || ''} onValueChange={(v) => setValue('evento.tipo_notificacao', v, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{TIPOS_NOTIFICACAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <FieldError name="evento.tipo_notificacao" />
      </div>
      <div><Label>Possível causa do evento *</Label><Input {...register('evento.causa')} /><FieldError name="evento.causa" /></div>
      <div><Label>Data de início do evento *</Label><Input type="date" {...register('evento.data_inicio')} /><FieldError name="evento.data_inicio" /></div>
      <div>
        <Label>Paciente se recuperou? *</Label>
        <div className="flex gap-4 mt-2 flex-wrap">
          {RECUPERACAO_OPCOES.map((o) => <label key={o} className="flex items-center gap-2"><input type="radio" value={o} {...register('evento.recuperou')} /> {o}</label>)}
        </div>
        {recuperou === 'Sim' && <div className="mt-2"><Label>Data da recuperação</Label><Input type="date" {...register('evento.data_recuperacao')} /></div>}
      </div>
      <div>
        <Label>O evento foi tratado? *</Label>
        <div className="flex gap-4 mt-2">
          {['Sim', 'Não'].map((s) => <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('evento.tratado')} /> {s}</label>)}
        </div>
        {tratado === 'Sim' && <div className="mt-2"><Label>Qual tratamento?</Label><Input {...register('evento.tratamento_desc')} /></div>}
      </div>
      <div>
        <Label>Apresentou outros eventos adversos?</Label>
        <div className="flex gap-4 mt-2">
          {['Sim', 'Não'].map((s) => <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('evento.outros_eventos_tem')} /> {s}</label>)}
        </div>
        {outros === 'Sim' && (
          <div className="space-y-3 mt-3">
            {outrosEventos.fields.map((f, i) => (
              <div key={f.id} className="border rounded-lg p-3 bg-muted/20 space-y-2">
                <div className="grid md:grid-cols-2 gap-2">
                  <div><Label className="text-xs">Evento</Label><Input {...register(`evento.outros_eventos.${i}.evento`)} /></div>
                  <div><Label className="text-xs">Data de início</Label><Input type="date" {...register(`evento.outros_eventos.${i}.data_inicio`)} /></div>
                  <div>
                    <Label className="text-xs">Continua?</Label>
                    <div className="flex gap-3 mt-1">
                      {['Sim', 'Não'].map((s) => <label key={s} className="flex items-center gap-1 text-sm"><input type="radio" value={s} {...register(`evento.outros_eventos.${i}.continua`)} /> {s}</label>)}
                    </div>
                  </div>
                  <div><Label className="text-xs">Data de término</Label><Input type="date" {...register(`evento.outros_eventos.${i}.data_termino`)} /></div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => outrosEventos.remove(i)}><Trash2 className="w-4 h-4 mr-1" />Remover</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => outrosEventos.append({ evento: '', data_inicio: '', continua: undefined, data_termino: '' })}><Plus className="w-4 h-4 mr-1" />Adicionar evento</Button>
          </div>
        )}
      </div>
      <div>
        <Label>Suspendeu o uso do medicamento por conta do evento?</Label>
        <div className="flex gap-4 mt-2">
          {['Sim', 'Não'].map((s) => <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('evento.suspendeu')} /> {s}</label>)}
        </div>
      </div>
      <div>
        <Label>Gravidade</Label>
        <div className="flex gap-4 mt-2">
          {['Não grave', 'Grave'].map((s) => <label key={s} className="flex items-center gap-2"><input type="radio" value={s} {...register('evento.gravidade')} /> {s}</label>)}
        </div>
        {gravidade === 'Grave' && (
          <div className="mt-3 space-y-2 border rounded-lg p-3 bg-destructive/5">
            <Label className="text-sm">Critérios (marque um ou mais)</Label>
            {CRITERIOS_GRAVIDADE.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={criterios.includes(c)}
                  onCheckedChange={(v) => {
                    const next = v ? [...criterios, c] : criterios.filter((x) => x !== c);
                    setValue('evento.criterios_gravidade', next);
                  }}
                /> {c}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 text-sm py-1 border-b border-dashed border-muted last:border-0">
      <span className="text-muted-foreground sm:w-56 shrink-0">{label}</span>
      <span className="font-medium break-words">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
    </div>
  );
}

function Step6({ farmaceuticaNome }: { farmaceuticaNome: string }) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<FarmacoForm>();
  const v = watch();
  const consent = watch('consentimento');
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-sm text-amber-900 dark:text-amber-200">
        <strong>Atenção:</strong> este relato será enviado diretamente à farmacêutica <b>{farmaceuticaNome || '—'}</b>. Você também pode notificar a ANVISA pelo sistema VigiMed.
      </div>
      <Card><CardHeader><CardTitle className="text-base">Relator</CardTitle></CardHeader><CardContent className="space-y-1">
        <Row label="Nome" value={v.relator?.nome} />
        <Row label="E-mail" value={v.relator?.email} />
        <Row label="Telefone" value={v.relator?.telefone} />
        <Row label="Profissão" value={v.relator?.profissao} />
        <Row label="CRM / UF" value={[v.relator?.crm, v.relator?.uf].filter(Boolean).join(' / ')} />
        <Row label="Instituição" value={v.relator?.vinculo_instituicao === 'Sim' ? v.relator?.instituicao_nome : 'Não vinculado'} />
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Paciente</CardTitle></CardHeader><CardContent className="space-y-1">
        <Row label="Identificação" value={v.paciente?.identificacao} />
        <Row label="Sexo" value={v.paciente?.sexo} />
        <Row label="Gestante" value={v.paciente?.gestante} />
        <Row label="DUM" value={v.paciente?.dum} />
        <Row label="Semanas gestacionais" value={v.paciente?.semanas_gestacionais} />
        <Row label="Nascimento" value={v.paciente?.data_nascimento} />
        <Row label="Peso (kg)" value={v.paciente?.peso} />
        <Row label="Altura (cm)" value={v.paciente?.altura} />
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Produto</CardTitle></CardHeader><CardContent className="space-y-1">
        <Row label="Farmacêutica" value={farmaceuticaNome} />
        <Row label="Produto" value={v.produto?.produto} />
        <Row label="Lote" value={[v.produto?.lote_numero, v.produto?.lote_validade].filter(Boolean).join(' / val. ')} />
        <Row label="Indicação" value={v.produto?.indicacao} />
        <Row label="Via" value={v.produto?.via} />
        <Row label="Posologia" value={v.produto?.posologia} />
        <Row label="Início" value={v.produto?.data_inicio} />
        <Row label="Término" value={v.produto?.em_uso ? 'Em uso' : v.produto?.data_termino} />
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader><CardContent className="space-y-1">
        <Row label="Possui doenças" value={v.historico?.tem_doencas} />
        {v.historico?.doencas?.map((d: any, i: number) => <Row key={i} label={`Doença ${i + 1}`} value={`${d.nome}${d.data_diagnostico ? ` (${d.data_diagnostico})` : ''}`} />)}
        <Row label="Usa outros medicamentos" value={v.historico?.usa_outros_meds} />
        {v.historico?.outros_meds?.map((m: any, i: number) => <Row key={i} label={`Medicamento ${i + 1}`} value={`${m.nome}${m.dose_diaria ? ` — ${m.dose_diaria}` : ''}`} />)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Evento Adverso</CardTitle></CardHeader><CardContent className="space-y-1">
        <Row label="Descrição" value={v.evento?.descricao} />
        <Row label="Eventos" value={v.evento?.eventos} />
        <Row label="Tipo" value={v.evento?.tipo_notificacao} />
        <Row label="Causa" value={v.evento?.causa} />
        <Row label="Início" value={v.evento?.data_inicio} />
        <Row label="Recuperou" value={v.evento?.recuperou} />
        <Row label="Data recuperação" value={v.evento?.data_recuperacao} />
        <Row label="Tratado" value={v.evento?.tratado === 'Sim' ? `Sim — ${v.evento?.tratamento_desc || ''}` : v.evento?.tratado} />
        <Row label="Outros eventos" value={v.evento?.outros_eventos_tem} />
        <Row label="Suspendeu uso" value={v.evento?.suspendeu} />
        <Row label="Gravidade" value={v.evento?.gravidade === 'Grave' ? `Grave — ${(v.evento?.criterios_gravidade || []).join(', ')}` : v.evento?.gravidade} />
      </CardContent></Card>

      <div className="p-4 border rounded-lg bg-muted/30">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={!!consent} onCheckedChange={(val) => setValue('consentimento', !!val as any, { shouldValidate: true })} />
          <span className="text-sm">
            Autorizo que a equipe de farmacovigilância da farmacêutica entre em contato comigo para acompanhamento deste caso, conforme a LGPD. *
          </span>
        </label>
        {errors.consentimento && <p className="text-xs text-destructive mt-2">{String(errors.consentimento.message)}</p>}
      </div>
    </div>
  );
}

// ---------- Page ----------
export default function FarmacovigilanciaNovo() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const prefill = (location.state as any)?.prefill as FarmacovigilanciaPrefill | undefined;

  const [step, setStep] = useState(1);
  const [farmaceuticas, setFarmaceuticas] = useState<{ id: string; nome: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const methods = useForm<FarmacoForm>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      relator: {
        nome: '', email: user?.email ?? '', telefone: '',
        profissao: 'Médico(a)', crm: '', uf: '', vinculo_instituicao: 'Não', instituicao_nome: '',
      },
      paciente: {
        identificacao: prefill?.paciente?.nome ?? '',
        sexo: prefill?.paciente?.sexo === 'M' ? 'Masculino' : prefill?.paciente?.sexo === 'F' ? 'Feminino' : 'Não informado',
        data_nascimento: prefill?.paciente?.dataNascimento ?? '',
      } as any,
      produto: {
        farmaceutica_id: '',
        produto: [prefill?.produto?.nome, prefill?.produto?.apresentacao, prefill?.produto?.dose].filter(Boolean).join(' — '),
        posologia: prefill?.produto?.posologia ?? '',
        em_uso: false,
      } as any,
      historico: { tem_doencas: 'Não', doencas: [], usa_outros_meds: 'Não', outros_meds: [] },
      evento: {
        descricao: '', eventos: '', tipo_notificacao: '', causa: '', data_inicio: '',
        recuperou: 'Não sabe', tratado: 'Não', outros_eventos_tem: 'Não', outros_eventos: [],
        suspendeu: 'Não', gravidade: 'Não grave', criterios_gravidade: [],
      } as any,
      consentimento: false as any,
    },
  });

  // Load farmacêuticas
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('farmaceuticas').select('id, nome').eq('ativo', true).order('nome');
      if (error) { toast.error('Falha ao carregar farmacêuticas'); return; }
      setFarmaceuticas(data ?? []);
    })();
  }, []);

  // Pré-preencher perfil do médico
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('full_name, crm, uf, phone').eq('id', user.id).maybeSingle();
      if (data) {
        methods.setValue('relator.nome', data.full_name ?? methods.getValues('relator.nome'));
        methods.setValue('relator.crm', (data as any).crm ?? '');
        methods.setValue('relator.uf', (data as any).uf ?? '');
        methods.setValue('relator.telefone', (data as any).phone ?? '');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Guard against accidental unload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (!success) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [success]);

  const stepFields: Record<number, string[]> = {
    1: ['relator'],
    2: ['paciente'],
    3: ['produto'],
    4: ['historico'],
    5: ['evento'],
    6: ['consentimento'],
  };

  const next = async () => {
    const valid = await methods.trigger(stepFields[step] as any);
    if (!valid) { toast.error('Preencha os campos obrigatórios desta etapa'); return; }
    setStep((s) => Math.min(6, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const prev = () => { setStep((s) => Math.max(1, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const farmaceuticaNome = useMemo(() => {
    const id = methods.watch('produto.farmaceutica_id');
    return farmaceuticas.find((f) => f.id === id)?.nome ?? '';
  }, [methods.watch('produto.farmaceutica_id'), farmaceuticas]);

  const onSubmit = async (data: FarmacoForm) => {
    setSubmitting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('send-farmacovigilancia', {
        body: { relato: data },
      });
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || 'Falha ao enviar');
      setSuccess(res.protocolo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar relato. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExit = () => {
    if (success || confirm('Os dados preenchidos serão perdidos. Deseja sair?')) navigate(-1);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center px-4 py-12">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold">Relato enviado com sucesso</h1>
            <p className="text-sm text-muted-foreground">Sua notificação foi encaminhada à farmacêutica. Uma cópia foi enviada para o seu e-mail.</p>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Protocolo — guarde este número</p>
              <p className="text-2xl font-mono font-bold text-primary">{success}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setSuccess(null); setStep(1); methods.reset(); }}>
                <FileText className="w-4 h-4 mr-2" />Nova notificação
              </Button>
              <Button className="flex-1" onClick={() => navigate('/dashboard')}>Voltar ao dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleExit}><ArrowLeft className="w-5 h-5" /></Button>
          <ShieldAlert className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Notificação de Farmacovigilância</h1>
            <p className="text-xs text-muted-foreground">Relato de evento adverso — enviado diretamente à farmacêutica</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Stepper current={step} />
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <Card>
              <CardHeader><CardTitle>{STEPS[step - 1].label}</CardTitle></CardHeader>
              <CardContent>
                {step === 1 && <Step1 />}
                {step === 2 && <Step2 />}
                {step === 3 && <Step3 farmaceuticas={farmaceuticas} />}
                {step === 4 && <Step4 />}
                {step === 5 && <Step5 />}
                {step === 6 && <Step6 farmaceuticaNome={farmaceuticaNome} />}
              </CardContent>
            </Card>

            <div className="flex justify-between mt-6">
              <Button type="button" variant="outline" onClick={prev} disabled={step === 1 || submitting}>
                <ArrowLeft className="w-4 h-4 mr-2" />Voltar
              </Button>
              {step < 6 ? (
                <Button type="button" onClick={next}>Próximo<ArrowRight className="w-4 h-4 ml-2" /></Button>
              ) : (
                <Button type="submit" disabled={submitting}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando…</> : <><ShieldAlert className="w-4 h-4 mr-2" />Enviar relato</>}
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </main>
    </div>
  );
}
