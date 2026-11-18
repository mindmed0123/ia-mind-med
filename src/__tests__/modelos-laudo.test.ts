import { describe,it,expect } from 'vitest';
import { MODELOS_LAUDO,modeloBase,buildModeloTool,customModelo,normalizeModeloFields,modeloSnapshot } from '../../supabase/functions/_shared/modelos-laudo';
import { normalizeDocumentFormat } from '../../supabase/functions/_shared/document-format';
import { resolveModelo } from '../../supabase/functions/_shared/resolve-modelo';

const original = {type:'function',function:{name:'generate_laudo',parameters:{type:'object',properties:{hipotese_principal:{type:'object'},prescricoes_sugeridas:{type:'array',minItems:1,items:{type:'object',properties:{origem:{type:'string',enum:['mencionada','sugerida_ia']}},required:['origem']}}},required:['hipotese_principal','prescricoes_sugeridas']}}};
describe('Regras dos modelos médicos',()=>{
  it('conta sem escolha utiliza padrao',()=>{expect(modeloBase(undefined).id).toBe('padrao');});
  it('modelo inválido utiliza padrao',()=>{expect(modeloBase('inexistente').id).toBe('padrao');});
  it.each(['soap','anamnese','evolucao','exame'])('%s não permite inferência',id=>{expect(modeloBase(id).inferencia).toBe(false);});
  it.each(['soap','anamnese','evolucao','exame'])('%s não exige campos clínicos',id=>{const schema=buildModeloTool(modeloBase(id),original).function.parameters;expect(schema.required).toBeUndefined();expect(schema.properties.prescricoes_sugeridas.items.required).toBeUndefined();});
  it.each(['soap','anamnese','evolucao','exame'])('%s permite apenas prescrição mencionada',id=>{const rx=buildModeloTool(modeloBase(id),original).function.parameters.properties.prescricoes_sugeridas;expect(rx.minItems).toBe(0);expect(rx.items.properties.origem.enum).toEqual(['mencionada']);});
  it('padrao mantém o contrato de inferência existente',()=>{expect(buildModeloTool(modeloBase('padrao'),original)).toEqual(original);expect(modeloBase('padrao').inferencia).toBe(true);});
  it('personalizado herda inferência da base',()=>{expect(customModelo({id:'x',nome:'Teste',base:'soap',secoes:[{chave:'plano',rotulo:'Plano'}]}).inferencia).toBe(false);});
  it('personalizado completo herda inferência',()=>{expect(customModelo({id:'x',nome:'Teste',base:'padrao',secoes:[{chave:'plano',rotulo:'Plano'}]}).inferencia).toBe(true);});
  it('ausência de avaliação e plano mantém campos vazios',()=>{expect(normalizeModeloFields(modeloBase('soap'),{subjetivo:'Dor de cabeça'})).toEqual({subjetivo:'Dor de cabeça',objetivo:'',avaliacao:'',plano:''});});
  it('snapshot registra modelo, nome, inferência e versão',()=>{expect(modeloSnapshot(modeloBase('soap'))).toMatchObject({modelo_id:'soap',modelo_nome:'Consulta (SOAP)',inferencia:false,scope_version:'modelos-2026-10'});});
  it('rejeita chaves duplicadas em modelos pessoais',()=>{expect(()=>customModelo({id:'x',nome:'Teste',base:'soap',secoes:[{chave:'a',rotulo:'A'},{chave:'a',rotulo:'B'}]})).toThrow();});
  it('SOAP possui exatamente as quatro seções previstas',()=>{expect(MODELOS_LAUDO.find(m=>m.id==='soap')?.secoes.map(s=>s.chave)).toEqual(['subjetivo','objetivo','avaliacao','plano']);});
  it('formatação permanece independente do modelo clínico',()=>{expect(normalizeDocumentFormat({fonte:'Arial',corpo:12,margem_lateral:20})).toMatchObject({fonte:'Arial',corpo:12,margem_lateral:20});});
  it('organização travada prevalece sobre a escolha do médico',async()=>{
    const values: Record<string,any> = {profiles:{modelo_padrao_id:'padrao'},laudos:{sections:{modelo_selecionado_id:'evolucao'}},organization_members:{organization_id:'org'},organizations:{modelo_padrao_id:'soap',modelo_padrao_travado:true,owner_id:'owner'}};
    const client = {from:(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,single:async()=>({data:values[table],error:null}),maybeSingle:async()=>({data:values[table],error:null})};return chain;}};
    expect((await resolveModelo(client,'user','doc','exame')).id).toBe('soap');
  });
  it('organização sem trava permite trocar o modelo',async()=>{
    const values: Record<string,any> = {profiles:{modelo_padrao_id:'padrao'},laudos:{sections:{}},organization_members:{organization_id:'org'},organizations:{modelo_padrao_id:'soap',modelo_padrao_travado:false,owner_id:'owner'}};
    const client = {from:(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,single:async()=>({data:values[table],error:null}),maybeSingle:async()=>({data:values[table],error:null})};return chain;}};
    expect((await resolveModelo(client,'user','doc','exame')).id).toBe('exame');
  });
});

const clienteParceiro = (values: Record<string,any>) => ({from:(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,single:async()=>({data:values[table],error:null}),maybeSingle:async()=>({data:values[table] ?? null,error:null})};return chain;}});
const contaParceiro = (parceiro_slug: string | null, org: any = {modelo_padrao_id:null,modelo_padrao_travado:false,owner_id:'user'}) => ({profiles:{modelo_padrao_id:null,parceiro_slug},laudos:{sections:{}},organization_members:{organization_id:'org'},organizations:org});
describe('Restrição de modelo por parceiro',()=>{
  it('sindmepa que pede padrao explicitamente recebe soap',async()=>{
    const m = await resolveModelo(clienteParceiro(contaParceiro('sindmepa')),'user','doc','padrao');
    expect(m.id).toBe('soap'); expect(m.inferencia).toBe(false); expect(m.parceiro_slug).toBe('sindmepa');
  });
  it('sindmepa que pede soap recebe soap',async()=>{
    expect((await resolveModelo(clienteParceiro(contaParceiro('sindmepa')),'user','doc','soap')).id).toBe('soap');
  });
  it('sbacv que pede padrao recebe padrao',async()=>{
    const m = await resolveModelo(clienteParceiro(contaParceiro('sbacv')),'user','doc','padrao');
    expect(m.id).toBe('padrao'); expect(m.inferencia).toBe(true);
  });
  it('conta sem parceiro que pede padrao recebe padrao',async()=>{
    const m = await resolveModelo(clienteParceiro(contaParceiro(null)),'user','doc','padrao');
    expect(m.id).toBe('padrao'); expect(m.parceiro_slug).toBeUndefined();
  });
  it('organização travada em padrao com usuário sindmepa recebe soap',async()=>{
    const values = contaParceiro('sindmepa',{modelo_padrao_id:'padrao',modelo_padrao_travado:true,owner_id:'owner'});
    expect((await resolveModelo(clienteParceiro(values),'user','doc','exame')).id).toBe('soap');
  });
  it('personalizado com inferência em conta restrita resolve sem inferência',async()=>{
    const values = {...contaParceiro('sindmepa'),modelos_laudo_usuario:{id:'meu',nome:'Meu completo',base:'padrao',inferencia:true,secoes:[{chave:'plano',rotulo:'Plano'}]}};
    const m = await resolveModelo(clienteParceiro(values),'user','doc','meu');
    expect(m.id).toBe('meu'); expect(m.inferencia).toBe(false);
  });
  it('snapshot do laudo registra o parceiro de origem',()=>{
    expect(modeloSnapshot({...modeloBase('soap'),parceiro_slug:'sindmepa'})).toMatchObject({modelo_id:'soap',inferencia:false,scope_version:'modelos-2026-10',parceiro_slug:'sindmepa'});
  });
});
