import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory rate limiter (best-effort per instance)
const rateMap = new Map<string, number[]>()
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 10
const DAILY_MAX = 10
const MAX_BODY_CHARS = 40_000
const MAX_FIELD_CHARS = 4_000

// Trims every string in the report so a request cannot carry oversized content.
function limitStrings(value: any, depth = 0): any {
  if (depth > 5) return null
  if (typeof value === 'string') return value.slice(0, MAX_FIELD_CHARS)
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => limitStrings(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value).slice(0, 80)) out[k] = limitStrings(v, depth + 1)
    return out
  }
  return value
}

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

    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_CHARS) {
      return new Response(JSON.stringify({ error: 'Relato muito grande' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    let body: any = null
    try { body = JSON.parse(rawBody) } catch { body = null }
    const relato = body?.relato ? limitStrings(body.relato) : null
    if (!relato || typeof relato !== 'object') {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Only doctors with an active plan and a registered professional ID may notify.
    const [{ data: profile }, { data: sub }] = await Promise.all([
      admin.from('profiles').select('full_name, conselho, registro_numero, registro_uf, crm, crm_uf').eq('id', user.id).maybeSingle(),
      admin.from('subscriptions').select('status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (!sub || !['ACTIVE', 'TRIALING'].includes(sub.status)) {
      return new Response(JSON.stringify({ error: 'Assinatura ativa necessária para enviar notificações.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const registro = (profile?.registro_numero || profile?.crm || '').toString().trim()
    if (!registro || profile?.conselho === 'CRP') {
      return new Response(JSON.stringify({ error: 'Complete seu registro profissional (CRM) no perfil antes de notificar.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Persistent daily limit per doctor (survives instance restarts).
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: sentToday } = await admin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('entity', 'farmacovigilancia')
      .eq('user_id', user.id)
      .gte('created_at', since)
    if ((sentToday ?? 0) >= DAILY_MAX) {
      return new Response(JSON.stringify({ error: 'Limite diário de notificações atingido. Tente novamente amanhã.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // The reporter identity always comes from the signed-in account, never the request.
    const uf = (profile?.registro_uf || profile?.crm_uf || '').toString().trim()
    relato.relator = {
      ...(relato.relator && typeof relato.relator === 'object' ? relato.relator : {}),
      nome: (profile?.full_name || relato?.relator?.nome || '').toString().trim(),
      email: user.email,
      crm: registro,
      ...(uf ? { uf } : {}),
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
    await admin.from('audit_logs').insert({
      entity: 'farmacovigilancia',
      entity_id: farm.id,
      user_id: user.id,
      action: 'SEND',
      diff: { protocolo, farmaceutica: farm.nome },
    })

    // Cópia para o próprio médico (best-effort — não bloqueia sucesso)
    if (user.email) {
      await enqueue(user.email, true, 'copia').catch(() => {})
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
