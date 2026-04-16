import { cookies, headers } from 'next/headers'
import { defaultLocale, isLocale, type Locale } from './config'

export async function getRequestLocale(): Promise<Locale> {
  // 1. Explicit cookie set by the switcher
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
  if (isLocale(cookieLocale)) return cookieLocale

  // 2. Browser Accept-Language header
  const headerStore = await headers()
  const acceptLang = headerStore.get('accept-language') ?? ''
  const primary = acceptLang.split(',')[0]?.split('-')[0]?.toLowerCase()
  if (isLocale(primary)) return primary

  return defaultLocale
}
