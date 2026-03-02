'use client'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Globe, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const LOCALES = [
  { value: 'hr', label: 'Hrvatski' },
  { value: 'en', label: 'English' },
] as const

export default function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()

  const setLocale = (nextLocale: 'hr' | 'en') => {
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${maxAge}`
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3">
          <Globe size={13} className="text-muted-foreground" />
          <span className="text-xs font-semibold tracking-wide">{locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLocale(l.value)}
            className={cn(
              'flex items-center justify-between gap-3 cursor-pointer',
              locale === l.value && 'font-medium'
            )}
          >
            <span>{l.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">{l.value.toUpperCase()}</span>
              {locale === l.value && <Check size={13} className="text-primary" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
