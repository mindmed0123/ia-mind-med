import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Hourly funnel email dispatcher.
 *
 * Sends 7 lifecycle emails based on profile/subscription state:
 *  - activation-nudge   (D+2 sem laudo)
 *  - activation-d5      (D+5 sem laudo, requires activation-nudge sent)
 *  - mid-trial-value    (trial D+7)
 *  - conversion-offer   (trial D+11)
 *  - winback-d3         (3 dias após trial_end, sem conversão)
 *  - winback-d15        (15 dias após trial_end, sem conversão, requires winback-d3)
 *  - upgrade-prompt     (30d ACTIVE em Starter com >=15 laudos último mês)
 *
 * Deduplication via public.email_sent_log unique(user_id, template_name).
 */

type Profile = { id: string; email: string | null; full_name: string | null }

const TEMPLATES = [
  'activation-nudge',
  'activation-d5',
  'mid-trial-value',
  'conversion-offer',
  'winback-d3',
  'winback-d15',
  'upgrade-prompt',
] as const

type TemplateName = typeof TEMPLATES[number]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const stats: Record<string, number> = {}
  for (const t of TEMPLATES) stats[t] = 0

  // Helper: derive first name
  const firstName = (full: string | null | undefined) =>
    ((full || '').trim().split(/\s+/)[0] || undefined)

  // Helper: format DD/MM/YYYY
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  // Helper: insert sent record (returns false if duplicate)
  const markSent = async (userId: string, template: TemplateName, recipient: string) => {
    const { error } = await supabase
      .from('email_sent_log')
      .insert({ user_id: userId, template_name: template, recipient_email: recipient })
    if (error) {
      // Unique-violation → already sent
      if ((error as any).code === '23505') return false
      console.error('email_sent_log insert error', error)
      return false
    }
    return true
  }

  // Helper: did we already send X to user Y?
  const hasSent = async (userId: string, template: TemplateName) => {
    const { count } = await supabase
      .from('email_sent_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('template_name', template)
    return (count ?? 0) > 0
  }

  const dispatch = async (
    template: TemplateName,
    profile: Profile,
    templateData: Record<string, unknown>,
  ) => {
    if (!profile.email) return
    // Try to mark as sent first; if dup, skip
    const ok = await markSent(profile.id, template, profile.email)
    if (!ok) return
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: template,
          recipientEmail: profile.email,
          idempotencyKey: `${template}-${profile.id}`,
          templateData,
        },
      })
      stats[template]++
    } catch (err) {
      console.error(`Failed to send ${template}`, err)
    }
  }

  // ---------------------------------------------
  // 1 & 2. activation-nudge (D+2) & activation-d5 (D+5)
  //   Eligible profiles: created_at in window AND no laudos yet.
  // ---------------------------------------------
  const activationChecks: Array<{
    template: TemplateName
    minHours: number
    maxHours: number
    daysRemaining: number
    requiresPrior?: TemplateName
  }> = [
    { template: 'activation-nudge', minHours: 47, maxHours: 49, daysRemaining: 12 },
    { template: 'activation-d5', minHours: 119, maxHours: 121, daysRemaining: 9, requiresPrior: 'activation-nudge' },
  ]

  for (const check of activationChecks) {
    const now = Date.now()
    const lowerIso = new Date(now - check.maxHours * 3_600_000).toISOString()
    const upperIso = new Date(now - check.minHours * 3_600_000).toISOString()

    const { data: candidates } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .gte('created_at', lowerIso)
      .lte('created_at', upperIso)

    for (const p of candidates ?? []) {
      if (!p.email) continue
      // Has any laudo?
      const { count: laudoCount } = await supabase
        .from('laudos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', p.id)
      if ((laudoCount ?? 0) > 0) continue

      if (check.requiresPrior && !(await hasSent(p.id, check.requiresPrior))) continue

      await dispatch(check.template, p as Profile, {
        firstName: firstName(p.full_name),
        daysRemaining: check.daysRemaining,
      })
    }
  }

  // ---------------------------------------------
  // 3 & 4. mid-trial-value (D+7) & conversion-offer (D+11)
  //   Based on TRIALING subscriptions with trial_start in 2h window.
  // ---------------------------------------------
  const trialChecks: Array<{ template: TemplateName; days: number }> = [
    { template: 'mid-trial-value', days: 7 },
    { template: 'conversion-offer', days: 11 },
  ]

  for (const check of trialChecks) {
    const now = Date.now()
    // trial_start was approximately N days ago, within a 2h window
    const upperIso = new Date(now - check.days * 86_400_000).toISOString()
    const lowerIso = new Date(now - (check.days * 86_400_000 + 2 * 3_600_000)).toISOString()

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id, trial_start, trial_end, status')
      .eq('status', 'TRIALING')
      .gte('trial_start', lowerIso)
      .lte('trial_start', upperIso)

    for (const sub of subs ?? []) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', sub.user_id)
        .maybeSingle()
      if (!profile?.email) continue

      const daysRemaining = sub.trial_end
        ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - now) / 86_400_000))
        : 14 - check.days

      const data: Record<string, unknown> = {
        firstName: firstName(profile.full_name),
        daysRemaining,
      }
      if (check.template === 'conversion-offer' && sub.trial_end) {
        data.trialEndDate = fmtDate(sub.trial_end)
      }

      await dispatch(check.template, profile as Profile, data)
    }
  }

  // ---------------------------------------------
  // 5 & 6. winback-d3 & winback-d15
  //   trial_end N days ago, NOT converted (status != ACTIVE).
  // ---------------------------------------------
  const winbackChecks: Array<{
    template: TemplateName
    days: number
    requiresPrior?: TemplateName
  }> = [
    { template: 'winback-d3', days: 3 },
    { template: 'winback-d15', days: 15, requiresPrior: 'winback-d3' },
  ]

  for (const check of winbackChecks) {
    const now = Date.now()
    const upperIso = new Date(now - check.days * 86_400_000).toISOString()
    const lowerIso = new Date(now - (check.days * 86_400_000 + 2 * 3_600_000)).toISOString()

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id, trial_end, status')
      .in('status', ['EXPIRED', 'INACTIVE', 'CANCELED', 'TRIALING'])
      .gte('trial_end', lowerIso)
      .lte('trial_end', upperIso)

    for (const sub of subs ?? []) {
      // Skip if user has any ACTIVE subscription (converted)
      const { count: activeCount } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', sub.user_id)
        .eq('status', 'ACTIVE')
      if ((activeCount ?? 0) > 0) continue

      if (check.requiresPrior && !(await hasSent(sub.user_id, check.requiresPrior))) continue

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', sub.user_id)
        .maybeSingle()
      if (!profile?.email) continue

      await dispatch(check.template, profile as Profile, {
        firstName: firstName(profile.full_name),
      })
    }
  }

  // ---------------------------------------------
  // 7. upgrade-prompt
  //   ACTIVE Starter subs >= 30 days old AND >=15 laudos last 30 days.
  // ---------------------------------------------
  {
    const now = Date.now()
    const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString()

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id, plan, status, current_period_start, created_at')
      .eq('status', 'ACTIVE')
      .eq('plan', 'STARTER')
      .lte('created_at', thirtyDaysAgo)

    for (const sub of subs ?? []) {
      const { count: laudoCount } = await supabase
        .from('laudos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', sub.user_id)
        .gte('created_at', thirtyDaysAgo)
      if ((laudoCount ?? 0) < 15) continue

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', sub.user_id)
        .maybeSingle()
      if (!profile?.email) continue

      await dispatch('upgrade-prompt', profile as Profile, {
        firstName: firstName(profile.full_name),
      })
    }
  }

  console.log('check-email-triggers stats:', stats)
  return new Response(JSON.stringify({ ok: true, sent: stats }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
