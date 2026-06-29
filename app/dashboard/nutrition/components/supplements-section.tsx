'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

export type Supplement = {
  id: string
  name: string
  amount: string
  timing: string
}

const COMMON_SUPPLEMENTS = [
  { name: 'Kreatin',    amount: '5g'     },
  { name: 'Omega 3',   amount: '2g'      },
  { name: 'Vitamin D', amount: '2000 IJ' },
  { name: 'Magnezij',  amount: '300mg'   },
  { name: 'Vitamin C', amount: '500mg'   },
  { name: 'Protein',   amount: '30g'     },
  { name: 'Cink',      amount: '15mg'    },
  { name: 'B12',       amount: '1000mcg' },
]

function TimingSelect({
  value,
  onChange,
  options,
  small = false,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  small?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = options.find(o => o.value === value)?.label ?? value

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 border border-gray-200 rounded-lg bg-white hover:border-purple-300 transition-colors ${
          small
            ? 'h-6 pl-2.5 pr-1.5 text-[10px] font-medium text-gray-600 rounded-full bg-gray-50'
            : 'h-8 pl-3 pr-2 text-sm text-gray-600'
        }`}
      >
        <span>{label}</span>
        <ChevronDown size={small ? 9 : 11} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-[200] bottom-full mb-1 left-0 min-w-[130px] bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 ${
                opt.value === value
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.value === value && <Check size={11} className="text-purple-500 shrink-0" />}
              <span className={opt.value === value ? '' : 'pl-[15px]'}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function SupplementsSection({
  supplements,
  onChange,
}: {
  supplements: Supplement[]
  onChange: (s: Supplement[]) => void
}) {
  const t = useTranslations('clients.mealPlans.supplements')
  const [open, setOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [customTiming, setCustomTiming] = useState('jutro')
  const expandRef = useRef<HTMLDivElement>(null)

  const TIMING_OPTIONS = [
    { value: 'jutro',       label: t('timingMorning')  },
    { value: 'predtrening', label: t('timingPre')       },
    { value: 'posttrening', label: t('timingPost')      },
    { value: 'večera',      label: t('timingEvening')   },
    { value: 'uz obrok',    label: t('timingWithMeal')  },
  ]

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      setTimeout(() => expandRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
    }
  }

  const add = (name: string, amount: string, timing = 'jutro') =>
    onChange([...supplements, { id: `supp-${Date.now()}`, name, amount, timing }])

  const remove = (id: string) => onChange(supplements.filter(s => s.id !== id))

  const updateField = (id: string, field: keyof Omit<Supplement, 'id'>, value: string) =>
    onChange(supplements.map(s => s.id === id ? { ...s, [field]: value } : s))

  const addCustom = () => {
    if (!customName.trim()) return
    add(customName.trim(), customAmount.trim() || '—', customTiming)
    setCustomName('')
    setCustomAmount('')
  }

  const alreadyAdded = new Set(supplements.map(s => s.name.toLowerCase()))

  return (
    <div className="space-y-2">
      {/* Toggle header */}
      <button
        type="button"
        onClick={toggle}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{t('title')}</span>
          {supplements.length > 0 && (
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
              {supplements.length}
            </span>
          )}
          <span className="text-xs text-gray-400 font-normal">({t('optional')})</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div ref={expandRef} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-3">

          {/* Quick-add chips */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{t('quickAdd')}</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SUPPLEMENTS.map(s => {
                const added = alreadyAdded.has(s.name.toLowerCase())
                return (
                  <button
                    key={s.name}
                    type="button"
                    disabled={added}
                    onClick={() => add(s.name, s.amount)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                      added
                        ? 'bg-purple-100 text-purple-600 border-purple-200 opacity-60 cursor-default'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    {added ? <Check size={10} /> : <Plus size={10} />}
                    {s.name}
                    <span className="text-gray-400">· {s.amount}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Added list */}
          {supplements.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t('added')}</p>
              {supplements.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-1.5">
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{s.name}</span>
                  <input
                    value={s.amount}
                    onChange={e => updateField(s.id, 'amount', e.target.value)}
                    className="w-20 h-6 text-xs font-semibold text-purple-600 border border-purple-200 rounded px-2 focus:border-purple-400 focus:outline-none text-center bg-purple-50"
                    placeholder="npr. 5g"
                  />
                  <TimingSelect
                    value={s.timing}
                    onChange={v => updateField(s.id, 'timing', v)}
                    options={TIMING_OPTIONS}
                    small
                  />
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Custom add row */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{t('addCustom')}</p>
            <div className="flex gap-1.5">
              <input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                placeholder={t('namePlaceholder')}
                className="flex-1 h-8 text-sm border border-gray-200 rounded-lg px-3 focus:border-purple-300 focus:outline-none bg-white"
              />
              <input
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                placeholder={t('amountPlaceholder')}
                className="w-24 h-8 text-sm border border-gray-200 rounded-lg px-3 focus:border-purple-300 focus:outline-none bg-white"
              />
              <TimingSelect
                value={customTiming}
                onChange={setCustomTiming}
                options={TIMING_OPTIONS}
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customName.trim()}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-white disabled:opacity-40 transition-colors bg-purple-600 hover:bg-purple-700 shrink-0"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

