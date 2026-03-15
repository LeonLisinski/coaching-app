'use client'

import { useState, useEffect, useCallback } from 'react'

type PushState = 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'loading'

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  const checkState = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported'); return
    }

    const permission = Notification.permission
    if (permission === 'denied') { setState('denied'); return }

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) { setSubscription(sub); setState('subscribed') }
    else setState('prompt')
  }, [])

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => checkState())
    }
  }, [checkState])

  // Navigate to URL when notif clicked while app is open
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'PUSH_NAVIGATE' && e.data.url) {
        window.location.href = e.data.url
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) return false
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState('denied'); return false }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })

      setSubscription(sub)
      setState('subscribed')
      return true
    } catch (err) {
      console.error('Push subscribe error:', err)
      setState('prompt')
      return false
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    await subscription.unsubscribe()
    setSubscription(null)
    setState('prompt')
  }, [subscription])

  return { state, subscribe, unsubscribe, subscription }
}
