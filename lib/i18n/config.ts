export const locales = ['hr', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'hr'
export function isLocale(value: string | undefined | null): value is Locale {
  return (locales as readonly string[]).includes(value ?? '')
}
