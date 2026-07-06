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

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'mailto:support@polyhq.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
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
    if (!userIds.length) return 0
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)
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
          if (code === 410 || code === 404) staleIds.push(sub.id)
        }
      }),
    )
    if (staleIds.length) await admin.from('push_subscriptions').delete().in('id', staleIds)
    return sent
  }

  // ── Clock-in reminder ────────────────────────────────────────────────────────
  if (type === 'clock_in_reminder') {
    const { data: employees } = await admin.from('profiles').select('id').eq('role', 'employee')
    const ids = (employees || []).map((e: { id: string }) => e.id)
    const sent = await pushToUsers(ids, "Time to clock in ⏰", "Don't forget to clock in for your shift!", '/employee')
    return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
  }

  // ── Clock-out reminder ───────────────────────────────────────────────────────
  if (type === 'clock_out_reminder') {
    const { data: employees } = await admin.from('profiles').select('id').eq('role', 'employee')
    const ids = (employees || []).map((e: { id: string }) => e.id)
    const sent = await pushToUsers(ids, "Time to clock out 🏁", 'Remember to clock out before you leave!', '/employee')
    return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
  }

  // ── 30-min job reminder ──────────────────────────────────────────────────────
  if (type === 'job_reminder' && check_time && today) {
    // Fetch all jobs for today that have a start time
    const { data: jobs } = await admin
      .from('jobs')
      .select('id, assigned_to, start_time, client_name, service_type')
      .eq('date', today)
      .not('start_time', 'is', null)

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
    return new Response(JSON.stringify({ sent, reminders: eligible.length }), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400 })
})
