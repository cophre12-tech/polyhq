import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // All responses — including errors — carry CORS headers so the browser never
  // sees a CORS failure masking the real error message.
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    // ── Verify secrets are present before touching Stripe ─────────────────────
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('[stripe-checkout] secret check — STRIPE_SECRET_KEY present:', !!stripeKey)
    console.log('[stripe-checkout] secret check — SUPABASE_URL present:', !!supabaseUrl)
    console.log('[stripe-checkout] secret check — SUPABASE_SERVICE_ROLE_KEY present:', !!serviceRole)

    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not configured in edge function secrets' }, 500)
    if (!supabaseUrl || !supabaseAnon) return json({ error: 'Supabase env vars missing' }, 500)
    if (!serviceRole) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in edge function secrets' }, 500)

    // ── Authenticate caller ───────────────────────────────────────────────────
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)

    const anonClient = createClient(supabaseUrl, supabaseAnon)
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
    console.log('[stripe-checkout] auth — user present:', !!user, '| error:', authErr?.message ?? null)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceRole)

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json()
    const { action, price_id, business_id } = body
    console.log('[stripe-checkout] request — action:', action ?? 'checkout', '| price_id:', price_id, '| business_id:', business_id)

    // ── Init Stripe ───────────────────────────────────────────────────────────
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })
    console.log('[stripe-checkout] Stripe client initialised')

    // ── Customer Portal ───────────────────────────────────────────────────────
    if (action === 'portal') {
      if (!business_id) return json({ error: 'business_id required' }, 400)

      const { data: sub, error: subErr } = await admin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('business_id', business_id)
        .single()

      console.log('[stripe-checkout] portal — stripe_customer_id:', sub?.stripe_customer_id ?? null, '| db error:', subErr?.message ?? null)

      if (!sub?.stripe_customer_id) {
        return json({ error: 'No billing account found. Please contact support@polyhq.app.' }, 400)
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: 'https://polyhqapp.com/owner/settings?tab=subscription',
      })
      console.log('[stripe-checkout] portal session created:', portalSession.id)
      return json({ url: portalSession.url })
    }

    // ── Checkout Session ──────────────────────────────────────────────────────
    if (!price_id || !business_id) {
      return json({ error: 'price_id and business_id are required' }, 400)
    }

    const { data: sub, error: subErr } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('business_id', business_id)
      .single()

    console.log('[stripe-checkout] checkout — existing stripe_customer_id:', sub?.stripe_customer_id ?? null, '| db error:', subErr?.message ?? null)

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: 'https://polyhqapp.com/owner/settings?tab=subscription&paid=1',
      cancel_url: 'https://polyhqapp.com/owner/settings?tab=subscription',
      metadata: { business_id },
      subscription_data: { metadata: { business_id } },
    }

    if (sub?.stripe_customer_id) {
      sessionParams.customer = sub.stripe_customer_id
    } else {
      sessionParams.customer_email = user.email
    }

    console.log('[stripe-checkout] creating Stripe checkout session for price:', price_id)
    const session = await stripe.checkout.sessions.create(sessionParams)
    console.log('[stripe-checkout] session created:', session.id)

    return json({ url: session.url })

  } catch (err) {
    // Any unhandled error lands here — still returns CORS headers so the
    // browser sees the actual message rather than a generic "failed to fetch".
    const message = err instanceof Error ? err.message : String(err)
    console.error('[stripe-checkout] unhandled error:', message)
    return json({ error: message }, 500)
  }
})
