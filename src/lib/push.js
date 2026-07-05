import { supabase } from './supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Request notification permission and save the push subscription to Supabase.
// Safe to call multiple times — idempotent via upsert on (user_id, endpoint).
export async function requestAndSubscribe(userId, businessId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (!VAPID_PUBLIC_KEY) return // Not configured — skip silently

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const { endpoint, keys } = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      business_id: businessId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'user_id,endpoint' })
  } catch {
    // Permission denied or SW not ready — ignore
  }
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
