'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Client component so that #access_token= hash fragments from Supabase
// password-reset emails are NOT discarded by a server-side redirect.
// AuthRecoveryHandler in providers.tsx picks up PASSWORD_RECOVERY and
// sends the user to /reset-password. For every other visit we go straight
// to /dashboard.
export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (window.location.hash.includes('access_token')) return
    router.replace('/dashboard')
  }, [router])

  return null
}
