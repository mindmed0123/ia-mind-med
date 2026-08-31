import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Trial de 7 dias: lembretes quando faltam 2 dias e 1 dia, e o aviso de expirado.
  const twoDaysFromNow = new Date()
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)
  
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const now = new Date()

  const { data: trials, error: trialsError } = await supabase
    .from('subscriptions')
    .select('user_id, trial_end, status, plan, plan_origem')
    .in('status', ['TRIALING', 'EXPIRED'])
    .gte('trial_end', oneDayAgo.toISOString())
    .lte('trial_end', twoDaysFromNow.toISOString())

  if (trialsError) {
    console.error('Failed to fetch trial subscriptions', trialsError)
    return new Response(JSON.stringify({ error: 'DB query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!trials || trials.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No trials expiring soon' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let skipped = 0

  for (const trial of trials) {
    const trialEnd = new Date(trial.trial_end)
    const diffMs = trialEnd.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    // trial-expired no dia 0/negativo; trial-reminder apenas na véspera (D+6)
    if (daysLeft < 0 || daysLeft > 1) {
      skipped++
      continue
    }

    // Get user profile for name and email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', trial.user_id)
      .maybeSingle()

    if (!profile?.email) {
      skipped++
      continue
    }

    // Idempotency key includes the date so we only send once per day per user
    const today = now.toISOString().slice(0, 10)
    const isExpired = daysLeft <= 0
    const templateName = isExpired ? 'trial-expired' : 'trial-reminder'
    const idempotencyKey = `${templateName}-${trial.user_id}-${today}`

    const { count: laudosCountRaw } = await supabase
      .from('laudos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', trial.user_id)
    const laudosCount = laudosCountRaw || 0

    // dd/mm do fim do trial
    const trialEndDate = `${String(trialEnd.getDate()).padStart(2, '0')}/${String(trialEnd.getMonth() + 1).padStart(2, '0')}`

    // Preço do plano escolhido
    const planPriceMap: Record<string, string> = {
      STARTER: 'R$ 149,00',
      PRO: 'R$ 299,00',
    }
    const planPrice = (trial as any).plan_origem === 'mindmed_fundador'
      ? 'R$ 1.990,00'
      : planPriceMap[(trial as any).plan as string] ?? undefined

    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName,
          recipientEmail: profile.email,
          idempotencyKey,
          templateData: {
            firstName: (profile.full_name || '').trim().split(/\s+/)[0] || undefined,
            doctorName: profile.full_name || undefined,
            ...(isExpired ? {} : { trialEndDate, planPrice, laudosCount }),
          },
        },
      })
      sent++
    } catch (err) {
      console.error('Failed to send trial reminder', {
        userId: trial.user_id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log(`Trial reminders processed: sent=${sent}, skipped=${skipped}`)

  return new Response(
    JSON.stringify({ sent, skipped, total: trials.length }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
