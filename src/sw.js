import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// Precache the app shell (list injected by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Cache Supabase API responses with NetworkFirst so the app works on spotty connections
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// ── Web Push ──────────────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return
  const { title = 'PolyHQ', body = '', url = '/' } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin))
      if (existing) {
        existing.navigate(url)
        return existing.focus()
      }
      return clients.openWindow(url)
    })
  )
})
