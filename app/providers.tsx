'use client'

import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { AppThemeProvider } from '@/app/contexts/app-theme'
import { ActiveChatProvider } from '@/app/contexts/active-chat'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthRecoveryHandler() {
  const router = useRouter()

  useEffect(() => {
    // When Supabase redirects to the homepage (because /reset-password isn't
    // in the allowed redirect URLs list), the PKCE exchange happens here and
    // fires a PASSWORD_RECOVERY event. We catch it and send the user to the
    // reset-password page where they can actually set a new password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}

type Props = {
  locale: Locale
  messages: Record<string, any>
  children: ReactNode
}

export default function Providers({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Zagreb">
      <AppThemeProvider>
        <ActiveChatProvider>
          <AuthRecoveryHandler />
          {children}
        </ActiveChatProvider>
      </AppThemeProvider>
    </NextIntlClientProvider>
  )
}

