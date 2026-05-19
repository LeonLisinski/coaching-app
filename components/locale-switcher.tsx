'use client'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'

export default function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()

  const toggleLocale = () => {
    const nextLocale = locale === 'hr' ? 'en' : 'hr'
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.refresh()
  }

  return (
    <button
      type="button"
      className="hdr-icon h-8 min-w-[46px] px-2.5 rounded-lg border border-transparent flex items-center justify-center text-xs font-semibold transition-colors lg:border-gray-200 lg:text-gray-700 lg:hover:text-gray-900 lg:hover:bg-gray-50 dark:lg:border-white/10 dark:lg:text-gray-300 dark:lg:hover:text-white dark:lg:hover:bg-white/10"
      onClick={toggleLocale}
    >
      {locale === 'hr' ? 'HR' : 'EN'}
    </button>
  )
}
