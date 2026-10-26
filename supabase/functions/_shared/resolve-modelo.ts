import { customModelo, modeloBase, type ModeloLaudo } from './modelos-laudo.ts';

export async function resolveModelo(client: any, userId: string, laudoId: string, requested?: unknown): Promise<ModeloLaudo> {
  if (requested != null && (typeof requested !== 'string' || requested.length > 100)) throw new Error('Modelo inválido');
  const [{ data: profile, error: profileError }, { data: laudo, error: laudoError }, { data: membership, error: memberError }] = await Promise.all([
    client.from('profiles').select('modelo_padrao_id').eq('id', userId).single(),
    client.from('laudos').select('sections').eq('id', laudoId).eq('user_id', userId).single(),
    client.from('organization_members').select('organization_id').eq('user_id', userId).eq('is_active', true).order('created_at').limit(1).maybeSingle(),
  ]);
  if (profileError || laudoError || memberError) throw new Error('Não foi possível resolver o modelo');
  let org: any = null;
  if (membership) {
    const result = await client.from('organizations').select('modelo_padrao_id, modelo_padrao_travado, owner_id').eq('id', membership.organization_id).single();
    if (result.error) throw new Error('Não foi possível consultar a organização');
    org = result.data;
  }
  const id = org?.modelo_padrao_travado && org?.modelo_padrao_id
    ? org.modelo_padrao_id
    : requested || laudo?.sections?.modelo_selecionado_id || org?.modelo_padrao_id || profile?.modelo_padrao_id || 'padrao';
  if (['padrao','soap','anamnese','evolucao','exame'].includes(id)) return modeloBase(id);
  // Personal models remain owner-scoped. An organization may use its owner's model.
  const owner = id === org?.modelo_padrao_id ? org.owner_id : userId;
  const { data, error } = await client.from('modelos_laudo_usuario').select('*').eq('id', id).eq('user_id', owner).maybeSingle();
  if (error) throw new Error('Não foi possível consultar o modelo');
  if (!data) {
    if (org?.modelo_padrao_travado && org?.modelo_padrao_id) throw new Error('Modelo da organização indisponível');
    return modeloBase('padrao');
  }
  return customModelo(data);
}