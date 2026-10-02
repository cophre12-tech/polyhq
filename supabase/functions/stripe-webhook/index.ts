// No JWT authentication — this endpoint is called by Stripe, not by logged-in
// users. All authenticity is established by verifying the Stripe-Signature
// header against STRIPE_WEBHOOK_SECRET (set in Supabase edge function secrets).
// JWT verification is disabled via supabase/config.toml: verify_jwt = false.
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TwmG51LS16ktisRhdXzrZox': 'pro',
  'price_1TwmLw1LS16ktisRmbfkvZTn': 'business',
  'price_1TwmMy1LS16ktisR5f4UzsZn': 'business',
}

Deno.serve(async (req) => {
  // Raw body must be captured before any other reads — Stripe signature
  // verification requires the exact bytes Stripe sent.
  const rawBody = await req.text()

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('[stripe-webhook] secret check — STRIPE_SECRET_KEY:', !!stripeKey, '| STRIPE_WEBHOOK_SECRET:', !!webhookSecret)

    if (!stripeKey || !webhookSecret) {
      console.error('[stripe-webhook] missing required secrets')
      return new Response('Configuration error', { status: 500 })
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // ── Verify Stripe signature ───────────────────────────────────────────────
    const sig = req.headers.get('stripe-signature')
    if (!sig) {
      console.error('[stripe-webhook] missing Stripe-Signature header')
      return new Response('Missing signature', { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[stripe-webhook] signature verification failed:', msg)
      return new Response('Invalid signature', { status: 400 })
    }

    console.log('[stripe-webhook] verified event:', event.type, '| id:', event.id)

    const admin = createClient(supabaseUrl!, serviceRole!)

    // ── checkout.session.completed ────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const businessId = session.metadata?.business_id

      if (!businessId) {
        console.error('[stripe-webhook] checkout.session.completed: no business_id in session metadata')
        return new Response('ok', { status: 200 })
      }

      let plan = 'pro'
      let subscriptionId: string | null = null

      if (session.subscription) {
        subscriptionId = session.subscription as string
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = sub.items.data[0]?.price.id
        plan = PRICE_TO_PLAN[priceId] ?? 'pro'
        console.log('[stripe-webhook] price_id:', priceId, '→ plan:', plan)
      }

      const { error } = await admin.from('subscriptions').upsert({
        business_id: businessId,
        plan,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
      }, { onConflict: 'business_id' })

      if (error) console.error('[stripe-webhook] DB upsert error:', error.message)
      else console.log('[stripe-webhook] plan set:', businessId, '→', plan)
    }

    // ── customer.subscription.updated ────────────────────────────────────────
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      const priceId = subscription.items.data[0]?.price.id
      const plan = PRICE_TO_PLAN[priceId] ?? 'pro'
      const customerId = subscription.customer as string

      console.log('[stripe-webhook] subscription updated — customer:', customerId, '| price:', priceId, '→ plan:', plan)

      const { error } = await admin.from('subscriptions')
        .update({ plan, stripe_subscription_id: subscription.id })
        .eq('stripe_customer_id', customerId)

      if (error) console.error('[stripe-webhook] subscription.updated DB error:', error.message)
    }

    // ── customer.subscription.deleted ────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      console.log('[stripe-webhook] subscription deleted — customer:', customerId)

      const { error } = await admin.from('subscriptions')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_customer_id', customerId)

      if (error) console.error('[stripe-webhook] subscription.deleted DB error:', error.message)
      else console.log('[stripe-webhook] plan reverted to free for customer:', customerId)
    }

    return new Response('ok', { status: 200 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook] unhandled error:', msg)
    return new Response('Internal error', { status: 500 })
  }
})
