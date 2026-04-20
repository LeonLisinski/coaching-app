import { escapeHtml } from '@/lib/html-escape'

export type ReminderLocale = 'hr' | 'en'

export function parseReminderLocale(raw: unknown): ReminderLocale {
  if (raw === 'en' || raw === 'en-US' || raw === 'en-GB') return 'en'
  return 'hr'
}

/** Jedan red: "Hi Name," / "Bok Name," — ime je escapeano. */
export function reminderGreetingLine(locale: ReminderLocale, firstName: string): string {
  const trimmed = firstName?.trim() || ''
  const safe = escapeHtml(trimmed || (locale === 'en' ? 'there' : 'korisniče'))
  return locale === 'en' ? `Hi ${safe},` : `Bok ${safe},`
}

/** Ručni podsjetnik (trenerov UI jezik → mail). */
export const manualReminderEmail = {
  hr: {
    subject: 'Podsjetnik: check-in – UnitLift',
    title: 'Podsjetnik za check-in',
    defaultMessage: 'Podsjetnik za check-in.',
  },
  en: {
    subject: 'Reminder: check-in – UnitLift',
    title: 'Check-in reminder',
    defaultMessage: 'Reminder about your check-in.',
  },
} as const

/** Dnevni cron — hrvatski (klijenti u HR tržištu). */
export const cronCheckinReminder = {
  subject: 'Podsjetnik: tjedni check-in – UnitLift',
  title: 'Tjedni check-in',
  bodyLine: 'Danas je dan za check-in — predaj ga u aplikaciji kad stigneš.',
} as const
