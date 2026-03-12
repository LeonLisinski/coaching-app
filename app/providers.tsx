'use client'

import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { AppThemeProvider } from '@/app/contexts/app-theme'

type Props = {
  locale: Locale
  messages: Record<string, any>
  children: ReactNode
}

export default function Providers({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppThemeProvider>
        {children}
      </AppThemeProvider>
    </NextIntlClientProvider>
  )
}
