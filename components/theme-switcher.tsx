'use client'

import { Sun, Moon } from 'lucide-react'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTranslations } from 'next-intl'

export default function ThemeSwitcher() {
  const { mode, setMode } = useAppTheme()
  const t = useTranslations('common')
  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      className="hdr-icon w-8 h-8 rounded-lg border border-transparent flex items-center justify-center transition-colors lg:border-gray-200 lg:text-gray-500 lg:hover:text-gray-800 lg:hover:bg-gray-100 dark:lg:border-white/10 dark:lg:text-gray-400 dark:lg:hover:text-gray-100 dark:lg:hover:bg-white/10"
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('theme_switch_to_light') : t('theme_switch_to_dark')}
      title={isDark ? t('theme_switch_to_light') : t('theme_switch_to_dark')}
    >
      {isDark
        ? <Sun size={15} className="lg:text-amber-400" />
        : <Moon size={15} />}
    </button>
  )
}
