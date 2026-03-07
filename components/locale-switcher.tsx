'use client'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()

  const toggleLocale = () => {
    const nextLocale = locale === 'hr' ? 'en' : 'hr'
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 min-w-[52px] px-3 font-semibold"
      onClick={toggleLocale}
      type="button"
    >
      {locale === 'hr' ? 'HR' : 'EN'}
    </Button>
  )
}
