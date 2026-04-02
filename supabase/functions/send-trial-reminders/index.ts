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

  // Find all TRIALING subscriptions where trial_end is within 5 days or just expired
  const fiveDaysFromNow = new Date()
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)
  
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const now = new Date()

  const { data: trials, error: trialsError } = await supabase
    .from('subscriptions')
    .select('user_id, trial_end, status')
    .in('status', ['TRIALING', 'EXPIRED'])
    .gte('trial_end', oneDayAgo.toISOString())
    .lte('trial_end', fiveDaysFromNow.toISOString())

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

    // Send trial-expired for day 0 or negative, trial-reminder for days 1-5
    if (daysLeft < 0 || daysLeft > 5) {
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

    // For trial-expired, get total laudos count
    let totalLaudos = 0
    if (isExpired) {
      const { count } = await supabase
        .from('laudos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', trial.user_id)
      totalLaudos = count || 0
    }

    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName,
          recipientEmail: profile.email,
          idempotencyKey,
          templateData: {
            doctorName: profile.full_name || undefined,
            daysLeft,
            ...(isExpired ? { totalLaudos } : {}),
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
