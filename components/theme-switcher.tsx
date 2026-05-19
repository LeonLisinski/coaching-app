'use client'

import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppTheme } from '@/app/contexts/app-theme'
import { useTranslations } from 'next-intl'

export default function ThemeSwitcher() {
  const { mode, setMode } = useAppTheme()
  const t = useTranslations('common')
  const isDark = mode === 'dark'

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 w-8 px-0"
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      type="button"
      aria-label={isDark ? t('theme_switch_to_light') : t('theme_switch_to_dark')}
      title={isDark ? t('theme_switch_to_light') : t('theme_switch_to_dark')}
    >
      {isDark
        ? <Sun size={15} className="text-amber-400" />
        : <Moon size={15} className="text-gray-600" />}
    </Button>
  )
}
