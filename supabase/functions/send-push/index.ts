import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user_ids, roles, business_id, title, body, url = '/' } = await req.json()

    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidSubject    = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@polyhq.com'

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // Use service role to read all subscriptions (bypasses RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let query = admin.from('push_subscriptions').select('*')

    if (user_ids?.length) {
      query = query.in('user_id', user_ids)
    } else if (roles?.length && business_id) {
      // Fetch user ids for the given roles within this business
      const { data: profiles } = await admin
        .from('profiles')
        .select('id')
        .eq('business_id', business_id)
        .in('role', roles)
      const ids = (profiles || []).map((p: { id: string }) => p.id)
      if (!ids.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders })
      query = query.in('user_id', ids)
    } else {
      return new Response(JSON.stringify({ error: 'user_ids or roles+business_id required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const { data: subs } = await query
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders })

    const payload = JSON.stringify({ title, body, url })
    const staleIds: string[] = []
    let sent = 0

    await Promise.all(subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        sent++
      } catch (err: unknown) {
        // 410 Gone = subscription expired; remove it
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) staleIds.push(sub.id)
      }
    }))

    if (staleIds.length) {
      await admin.from('push_subscriptions').delete().in('id', staleIds)
    }

    return new Response(JSON.stringify({ sent }), { headers: corsHeaders })
  } catch (err) {
    console.error('send-push error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
