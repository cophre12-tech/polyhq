import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'cophre12@gmail.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // Verify the caller is the admin
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return new Response('Unauthorized', { status: 401, headers: CORS })

  const verifier = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: { user }, error: authErr } = await verifier.auth.getUser(jwt)
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return new Response('Forbidden', { status: 403, headers: CORS })
  }

  // Service-role client — bypasses all RLS
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── GET: fetch all businesses with owner + plan + counts ─────────────────────
  if (req.method === 'GET') {
    // Run both queries in parallel; subscriptions is queried separately because
    // the nested-select approach relies on PostgREST auto-detecting the FK and
    // silently returns [] when the relationship name doesn't match exactly.
    const [bizResult, subResult] = await Promise.all([
      admin
        .from('businesses')
        .select('id, name, created_at, profiles ( id, name, email, role )')
        .order('created_at', { ascending: false }),
      admin
        .from('subscriptions')
        .select('business_id, plan'),
    ])

    if (bizResult.error) {
      console.error('[admin-panel] businesses query error:', bizResult.error)
      return new Response(JSON.stringify({ error: bizResult.error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Build a fast lookup: business_id → plan
    const planMap: Record<string, string> = {}
    for (const s of (subResult.data || [])) {
      planMap[s.business_id] = s.plan
    }

    const rows = (bizResult.data || []).map((b: {
      id: string
      name: string
      created_at: string
      profiles: { id: string; name: string; email: string; role: string }[]
    }) => {
      const owner = b.profiles?.find(p => p.role === 'owner') ?? b.profiles?.find(p => p.role === 'co_owner')
      const coOwners = b.profiles?.filter(p => p.role === 'co_owner' && p.id !== owner?.id) ?? []
      const employees = b.profiles?.filter(p => p.role === 'employee') ?? []
      return {
        id: b.id,
        name: b.name,
        created_at: b.created_at,
        plan: planMap[b.id] ?? 'free',
        owner_name: owner?.name ?? '—',
        owner_email: owner?.email ?? '—',
        co_owners: coOwners.map(p => ({ name: p.name, email: p.email })),
        employee_count: employees.length,
        member_count: b.profiles?.length ?? 0,
      }
    })

    return new Response(JSON.stringify({ businesses: rows }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── POST: mutate data ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await req.json()
    const { action } = body
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

    // Update a single business's plan
    if (action === 'update_plan') {
      const { business_id, plan } = body
      if (!business_id || !['free', 'pro', 'business'].includes(plan)) {
        return json({ error: 'Invalid business_id or plan' }, 400)
      }
      const { error } = await admin
        .from('subscriptions')
        .upsert({ business_id, plan }, { onConflict: 'business_id' })
      if (error) { console.error('[admin-panel] update_plan error:', error); return json({ error: error.message }, 500) }
      console.log('[admin-panel] plan updated:', business_id, '→', plan)
      return json({ ok: true })
    }

    // Delete one or more businesses (cascade removes all associated data)
    if (action === 'delete_businesses') {
      const { business_ids } = body as { business_ids: string[] }
      if (!Array.isArray(business_ids) || business_ids.length === 0) {
        return json({ error: 'business_ids must be a non-empty array' }, 400)
      }
      const { error } = await admin.from('businesses').delete().in('id', business_ids)
      if (error) { console.error('[admin-panel] delete_businesses error:', error); return json({ error: error.message }, 500) }
      console.log('[admin-panel] deleted businesses:', business_ids)
      return json({ ok: true, deleted: business_ids.length })
    }

    return json({ error: 'Unknown action' }, 400)
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
})
