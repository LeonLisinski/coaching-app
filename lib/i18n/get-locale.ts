import { defaultLocale, type Locale } from './config'

// Language switcher is temporarily disabled — always use Croatian.
// To re-enable, restore cookie + accept-language detection and uncomment LocaleSwitcher in layout.tsx.
export async function getRequestLocale(): Promise<Locale> {
  return defaultLocale
}
