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
    console.log('[send-push] Request received', { user_ids, roles, business_id, title, body, url })

    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidSubject    = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@polyhq.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[send-push] Missing VAPID keys — VAPID_PUBLIC_KEY:', !!vapidPublicKey, 'VAPID_PRIVATE_KEY:', !!vapidPrivateKey)
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500, headers: corsHeaders })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // Use service role to read all subscriptions (bypasses RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let query = admin.from('push_subscriptions').select('*')

    if (user_ids?.length) {
      console.log('[send-push] Targeting user_ids:', user_ids)
      query = query.in('user_id', user_ids)
    } else if (roles?.length && business_id) {
      // Fetch user ids for the given roles within this business
      console.log('[send-push] Fetching profiles for roles:', roles, 'in business:', business_id)
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id')
        .eq('business_id', business_id)
        .in('role', roles)
      if (profilesError) console.error('[send-push] profiles query error:', profilesError)
      const ids = (profiles || []).map((p: { id: string }) => p.id)
      console.log('[send-push] Found', ids.length, 'profiles with roles', roles)
      if (!ids.length) {
        console.log('[send-push] No matching profiles — sent: 0')
        return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders })
      }
      query = query.in('user_id', ids)
    } else {
      console.error('[send-push] Invalid request — need user_ids or roles+business_id')
      return new Response(JSON.stringify({ error: 'user_ids or roles+business_id required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const { data: subs, error: subsError } = await query
    if (subsError) console.error('[send-push] push_subscriptions query error:', subsError)
    console.log('[send-push] Found', subs?.length ?? 0, 'push subscriptions')

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
        console.log('[send-push] Sent to endpoint:', sub.endpoint.slice(0, 60) + '…')
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        console.error('[send-push] sendNotification failed — status:', statusCode, 'endpoint:', sub.endpoint.slice(0, 60) + '…', 'error:', String(err))
        // 410 Gone = subscription expired; remove it
        if (statusCode === 410 || statusCode === 404) staleIds.push(sub.id)
      }
    }))

    if (staleIds.length) {
      console.log('[send-push] Removing', staleIds.length, 'stale subscriptions')
      await admin.from('push_subscriptions').delete().in('id', staleIds)
    }

    console.log('[send-push] Done — sent:', sent, 'stale removed:', staleIds.length)
    return new Response(JSON.stringify({ sent }), { headers: corsHeaders })
  } catch (err) {
    console.error('[send-push] Unhandled error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
