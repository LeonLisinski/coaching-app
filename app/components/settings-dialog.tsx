'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useAppTheme, type AccentColor } from '@/app/contexts/app-theme'
import { Settings, Mail, Globe, Check, Palette } from 'lucide-react'
import { useTranslations } from 'next-intl'

const ACCENT_COLORS: { key: AccentColor; label: string; hex: string }[] = [
  { key: 'violet', label: 'Violet',  hex: '#7c3aed' },
  { key: 'blue',   label: 'Plava',   hex: '#2563eb' },
  { key: 'indigo', label: 'Indigo',  hex: '#4f46e5' },
  { key: 'sky',    label: 'Nebo',    hex: '#0284c7' },
  { key: 'teal',   label: 'Teal',    hex: '#0d9488' },
  { key: 'green',  label: 'Zelena',  hex: '#16a34a' },
  { key: 'yellow', label: 'Žuta',    hex: '#ca8a04' },
  { key: 'amber',  label: 'Amber',   hex: '#d97706' },
  { key: 'orange', label: 'Narančasta', hex: '#ea580c' },
  { key: 'red',    label: 'Crvena',  hex: '#dc2626' },
  { key: 'rose',   label: 'Roza',    hex: '#ec4899' },
  { key: 'slate',  label: 'Siva',    hex: '#475569' },
]

type Tab = 'theme' | 'contact'


interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsDialog({ open, onClose }: Props) {
  const t = useTranslations('settings')
  const { accent, setAccent } = useAppTheme()
  const [tab, setTab] = useState<Tab>('theme')

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        {/* Header */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, var(--app-accent), var(--app-accent-hover))` }}
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Settings size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">{t('title')}</h2>
            <p className="text-white/60 text-xs">{t('subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 dark:border-white/8 dark:bg-white/3">
          {([
            ['theme', <Palette size={14} />, t('tabs.theme')],
            ['contact', <Mail size={14} />, t('tabs.contact')],
          ] as [Tab, React.ReactNode, string][]).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === key
                  ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-white dark:bg-[oklch(0.165_0.025_264)]">

          {tab === 'theme' && (
            <>
              {/* Accent color */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">{t('accentColor')}</p>
                <div className="grid grid-cols-6 gap-2">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setAccent(c.key)}
                      title={c.label}
                      className="group relative w-full aspect-square rounded-xl transition-transform hover:scale-110 focus:outline-none"
                      style={{ backgroundColor: c.hex }}
                    >
                      {accent === c.key && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className="absolute inset-0 rounded-xl transition-opacity"
                        style={{
                          opacity: accent === c.key ? 1 : 0,
                          outline: `2.5px solid ${c.hex}`,
                          outlineOffset: '3px',
                        }}
                      />
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-xs text-gray-400">
                  Aktivna tema: <span className="font-semibold" style={{ color: ACCENT_COLORS.find(c => c.key === accent)?.hex }}>{ACCENT_COLORS.find(c => c.key === accent)?.label}</span>
                </p>
              </div>

            </>
          )}

          {tab === 'contact' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{t('contactDesc')}</p>

              <a
                href="mailto:info@unitlift.com"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 group-hover:bg-[var(--app-accent)] transition-colors">
                  <Mail size={16} className="text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Email</p>
                  <p className="text-xs text-gray-500">info@unitlift.com</p>
                </div>
              </a>

              <a
                href="https://unitlift.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-light)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-50 group-hover:bg-[var(--app-accent)] transition-colors">
                  <Globe size={16} className="text-violet-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t('website')}</p>
                  <p className="text-xs text-gray-500">unitlift.com</p>
                </div>
              </a>

              <div className="pt-3 border-t border-gray-100 text-center space-y-1">
                <p className="text-xs font-semibold text-gray-500">UnitLift · Coaching Platform</p>
                <p className="text-xs text-gray-400">UnitLift v2.1 · Alat za profesionalne trenere</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

