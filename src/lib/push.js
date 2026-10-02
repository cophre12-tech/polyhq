import { supabase } from './supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Request notification permission and save the push subscription to Supabase.
// Returns an array of { label, ok, detail } steps for UI diagnostics.
// Safe to call multiple times — idempotent via upsert on (user_id, endpoint).
export async function requestAndSubscribe(userId, businessId) {
  const steps = []

  function pass(label, detail) {
    steps.push({ label, ok: true, detail })
  }
  function fail(label, detail) {
    steps.push({ label, ok: false, detail })
    return steps
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return fail('Browser support', 'ServiceWorker or PushManager not available in this browser')
  }
  pass('Browser support', 'ServiceWorker and PushManager available')

  if (!VAPID_PUBLIC_KEY) {
    return fail('VAPID key', 'VITE_VAPID_PUBLIC_KEY is not set — check .env and rebuild')
  }
  pass('VAPID key', 'VITE_VAPID_PUBLIC_KEY is configured')

  let permission
  try {
    permission = await Notification.requestPermission()
  } catch (err) {
    return fail('Notification permission', `requestPermission() threw: ${err.message}`)
  }
  if (permission !== 'granted') {
    return fail('Notification permission', `"${permission}" — user must allow notifications in browser settings`)
  }
  pass('Notification permission', 'Granted')

  let reg
  try {
    reg = await navigator.serviceWorker.ready
    pass('Service worker', `Active: ${reg.active?.scriptURL ?? 'unknown'}`)
  } catch (err) {
    return fail('Service worker', `serviceWorker.ready rejected: ${err.message}`)
  }

  let sub
  try {
    sub = await reg.pushManager.getSubscription()
    if (sub) {
      pass('Push subscription', `Reusing existing subscription (${sub.endpoint.slice(0, 50)}…)`)
    } else {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      pass('Push subscription', `Created new subscription (${sub.endpoint.slice(0, 50)}…)`)
    }
  } catch (err) {
    return fail('Push subscription', `subscribe() failed: ${err.message}`)
  }

  try {
    const { endpoint, keys } = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, business_id: businessId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'user_id,endpoint' },
    )
    if (error) {
      return fail('Save to Supabase', `Upsert failed — ${error.message} (code: ${error.code})`)
    }
    pass('Save to Supabase', 'Subscription saved successfully')
  } catch (err) {
    return fail('Save to Supabase', `Upsert threw: ${err.message}`)
  }

  return steps
}

// Send a web push to all owners/co-owners of a business.
export function notifyOwners(businessId, { title, body, url = '/' }) {
  supabase.functions.invoke('send-push', {
    body: { roles: ['owner', 'co_owner'], business_id: businessId, title, body, url },
  }).catch(() => {})
}

// Send a web push to specific users by their IDs.
export function notifyUsers(userIds, { title, body, url = '/' }) {
  if (!userIds?.length) return
  supabase.functions.invoke('send-push', {
    body: { user_ids: userIds, title, body, url },
  }).catch(() => {})
}
