import { describe,it,expect } from 'vitest';
import { MODELOS_LAUDO,modeloBase,buildModeloTool,customModelo,normalizeModeloFields,modeloSnapshot } from '../../supabase/functions/_shared/modelos-laudo';
import { normalizeDocumentFormat } from '../../supabase/functions/_shared/document-format';

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
});