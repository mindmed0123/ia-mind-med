import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory rate limiter (best-effort per instance)
const rateMap = new Map<string, number[]>()
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 10

function checkRate(userId: string) {
  const now = Date.now()
  const arr = (rateMap.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (arr.length >= RATE_MAX) return false
  arr.push(now)
  rateMap.set(userId, arr)
  return true
}

function genProtocolo() {
  const now = new Date()
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `FV-${ymd}-${rand}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userErr } = await authed.auth.getUser()
    if (userErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (!checkRate(user.id)) {
      return new Response(JSON.stringify({ error: 'Limite de envios por hora atingido. Tente novamente mais tarde.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null)
    const relato = body?.relato
    if (!relato || typeof relato !== 'object') {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validação mínima server-side
    const required: [string, string][] = [
      ['relator.nome', relato?.relator?.nome],
      ['relator.email', relato?.relator?.email],
      ['relator.crm', relato?.relator?.crm],
      ['produto.farmaceutica_id', relato?.produto?.farmaceutica_id],
      ['produto.produto', relato?.produto?.produto],
      ['evento.descricao', relato?.evento?.descricao],
      ['evento.tipo_notificacao', relato?.evento?.tipo_notificacao],
      ['evento.data_inicio', relato?.evento?.data_inicio],
    ]
    for (const [k, v] of required) {
      if (!v || typeof v !== 'string' || !v.trim()) {
        return new Response(JSON.stringify({ error: `Campo obrigatório ausente: ${k}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }
    if (relato.consentimento !== true) {
      return new Response(JSON.stringify({ error: 'Consentimento obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: farm, error: farmErr } = await admin
      .from('farmaceuticas')
      .select('id, nome, email_farmacovigilancia, ativo')
      .eq('id', relato.produto.farmaceutica_id)
      .maybeSingle()

    if (farmErr || !farm || !farm.ativo) {
      return new Response(JSON.stringify({ error: 'Farmacêutica inválida ou inativa' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const protocolo = genProtocolo()
    const dataEnvio = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    const templateData = {
      protocolo,
      dataEnvio,
      farmaceuticaNome: farm.nome,
      relato,
    }

    // Envia para a farmacêutica
    const enqueue = async (recipient: string, isCopy: boolean, idemSuffix: string) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          templateName: 'farmacovigilancia-notificacao',
          recipientEmail: recipient,
          idempotencyKey: `${protocolo}-${idemSuffix}`,
          templateData: { ...templateData, isCopiaMedico: isCopy },
        }),
      })
      return res.ok
    }

    const okFarm = await enqueue(farm.email_farmacovigilancia, false, 'farm')
    if (!okFarm) {
      return new Response(JSON.stringify({ error: 'Falha ao enviar para a farmacêutica' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // Cópia para o médico (best-effort — não bloqueia sucesso)
    if (relato?.relator?.email) {
      await enqueue(relato.relator.email, true, 'copia').catch(() => {})
    }

    return new Response(JSON.stringify({ success: true, protocolo }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-farmacovigilancia error', e)
    return new Response(JSON.stringify({ error: 'Erro interno ao processar relato' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
