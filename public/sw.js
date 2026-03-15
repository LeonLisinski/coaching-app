// UnitLift Service Worker - Push Notifications

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'UnitLift', body: event.data.text() } }

  const { title = 'UnitLift', body = '', url = '/dashboard', icon, badge, tag } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/apple-touch-icon.png',
      badge: badge || '/apple-touch-icon.png',
      tag: tag || 'unitlift',
      data: { url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If app is already open, focus it and navigate
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.postMessage({ type: 'PUSH_NAVIGATE', url })
        return
      }
      // Otherwise open a new window
      return self.clients.openWindow(url)
    })
  )
})
