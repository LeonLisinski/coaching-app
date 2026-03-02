import { cookies, headers } from 'next/headers'
import { defaultLocale, isLocale, type Locale } from './config'

export async function getRequestLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  if (isLocale(cookieLocale)) return cookieLocale

  const acceptLanguage = (await headers()).get('accept-language') || ''
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase()
  const normalized = first?.startsWith('en') ? 'en' : first?.startsWith('hr') ? 'hr' : null
  if (isLocale(normalized)) return normalized

  return defaultLocale
}
