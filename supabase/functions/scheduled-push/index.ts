import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'x-cron-secret, content-type' },
    })
  }

  // Only callable by pg_cron via the shared secret
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { type, check_time, today } = await req.json()
  console.log('[scheduled-push] Triggered', { type, check_time, today })

  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[scheduled-push] Missing VAPID keys — VAPID_PUBLIC_KEY:', !!vapidPublicKey, 'VAPID_PRIVATE_KEY:', !!vapidPrivateKey)
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500 })
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'mailto:support@polyhq.com',
    vapidPublicKey,
    vapidPrivateKey,
  )

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Send push to a list of user IDs. Returns count sent.
  async function pushToUsers(
    userIds: string[],
    title: string,
    body: string,
    url: string,
  ): Promise<number> {
    if (!userIds.length) {
      console.log('[scheduled-push] pushToUsers: no user IDs provided')
      return 0
    }
    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)
    if (subsError) console.error('[scheduled-push] push_subscriptions query error:', subsError)
    console.log('[scheduled-push] pushToUsers: found', subs?.length ?? 0, 'subscriptions for', userIds.length, 'users')
    if (!subs?.length) return 0

    const staleIds: string[] = []
    let sent = 0
    await Promise.all(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, url }),
          )
          sent++
        } catch (err: unknown) {
          const code = (err as { statusCode?: number }).statusCode
          console.error('[scheduled-push] sendNotification failed — status:', code, 'error:', String(err))
          if (code === 410 || code === 404) staleIds.push(sub.id)
        }
      }),
    )
    if (staleIds.length) {
      console.log('[scheduled-push] Removing', staleIds.length, 'stale subscriptions')
      await admin.from('push_subscriptions').delete().in('id', staleIds)
    }
    return sent
  }

  // ── Clock-in reminder ────────────────────────────────────────────────────────
  if (type === 'clock_in_reminder') {
    const { data: employees, error: empError } = await admin.from('profiles').select('id').eq('role', 'employee')
    if (empError) console.error('[scheduled-push] clock_in_reminder: profiles query error:', empError)
    const ids = (employees || []).map((e: { id: string }) => e.id)
    console.log('[scheduled-push] clock_in_reminder: found', ids.length, 'employees')
    const sent = await pushToUsers(ids, "Time to clock in ⏰", "Don't forget to clock in for your shift!", '/employee')
    console.log('[scheduled-push] clock_in_reminder: sent', sent)
    return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
  }

  // ── Clock-out reminder ───────────────────────────────────────────────────────
  if (type === 'clock_out_reminder') {
    const { data: employees, error: empError } = await admin.from('profiles').select('id').eq('role', 'employee')
    if (empError) console.error('[scheduled-push] clock_out_reminder: profiles query error:', empError)
    const ids = (employees || []).map((e: { id: string }) => e.id)
    console.log('[scheduled-push] clock_out_reminder: found', ids.length, 'employees')
    const sent = await pushToUsers(ids, "Time to clock out 🏁", 'Remember to clock out before you leave!', '/employee')
    console.log('[scheduled-push] clock_out_reminder: sent', sent)
    return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
  }

  // ── 30-min job reminder ──────────────────────────────────────────────────────
  if (type === 'job_reminder' && check_time && today) {
    console.log('[scheduled-push] job_reminder: checking for jobs starting at', check_time, 'on', today)
    // Fetch all jobs for today that have a start time
    const { data: jobs, error: jobsError } = await admin
      .from('jobs')
      .select('id, assigned_to, start_time, client_name, service_type')
      .eq('date', today)
      .not('start_time', 'is', null)
    if (jobsError) console.error('[scheduled-push] job_reminder: jobs query error:', jobsError)
    console.log('[scheduled-push] job_reminder: found', jobs?.length ?? 0, 'jobs today with start_time set')

    // Build a map of each employee → their earliest job today
    const firstJob: Record<string, { id: string; start_time: string; client_name: string; service_type: string }> = {}
    for (const job of (jobs || [])) {
      for (const empId of (job.assigned_to || [])) {
        if (!firstJob[empId] || job.start_time < firstJob[empId].start_time) {
          firstJob[empId] = job
        }
      }
    }

    // Find employees whose first job starts at check_time (i.e. in ~30 min)
    const eligible = Object.entries(firstJob).filter(([, job]) => job.start_time === check_time)
    console.log('[scheduled-push] job_reminder: check_time=', check_time, '— eligible employees:', eligible.length)
    if (!eligible.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Group eligible employees by job so each job generates one push batch
    const byJob: Record<string, { empIds: string[]; job: typeof firstJob[string] }> = {}
    for (const [empId, job] of eligible) {
      if (!byJob[job.id]) byJob[job.id] = { empIds: [], job }
      byJob[job.id].empIds.push(empId)
    }

    let sent = 0
    for (const { empIds, job } of Object.values(byJob)) {
      sent += await pushToUsers(
        empIds,
        'Job starting soon ⏱',
        `${job.service_type} for ${job.client_name} in 30 minutes`,
        '/employee/schedule',
      )
    }
    console.log('[scheduled-push] job_reminder: sent', sent)
    return new Response(JSON.stringify({ sent, reminders: eligible.length }), { headers: { 'Content-Type': 'application/json' } })
  }

  console.error('[scheduled-push] Unknown type:', type)
  return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400 })
})
