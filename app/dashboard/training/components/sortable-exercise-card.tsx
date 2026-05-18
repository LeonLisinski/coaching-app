'use client'

import { useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EXERCISE_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import { useTranslations } from 'next-intl'

export type PlanExercise = {
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes: string
  exercise_type?: 'strength' | 'endurance'
  rir?: string
  rpe?: string
  tempo?: string
  duration?: string
  distance?: string
}

type Props = {
  ex: PlanExercise
  index: number
  onUpdate: (field: string, value: any) => void
  onRemove: () => void
  labelSets: string
  labelRest: string
  labelNotes: string
  activeExerciseFields?: string[]
}

export default function SortableExerciseCard({
  ex, index, onUpdate, onRemove, labelSets, labelRest, labelNotes, activeExerciseFields = [],
}: Props) {
  const t = useTranslations('training.dialogs.template')
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.exercise_id })

  const isEndurance = ex.exercise_type === 'endurance'
  const activeOptional = EXERCISE_FIELD_OPTIONS.filter(f => activeExerciseFields.includes(f.key))

  const summary = [
    ex.sets ? `${ex.sets}×${ex.reps || '—'}` : null,
    ex.rest_seconds ? `${ex.rest_seconds}s` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="border border-emerald-300 rounded-lg bg-emerald-50 overflow-hidden"
    >
      {/* Collapsed header — always visible */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button
          type="button" {...listeners} {...attributes}
          className="cursor-grab active:cursor-grabbing text-emerald-300 hover:text-emerald-500 shrink-0 touch-none"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <span className="text-sm font-semibold text-gray-800 truncate">{index + 1}. {ex.name}</span>
          {isEndurance && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shrink-0">
              {t('enduranceBadge')}
            </span>
          )}
          {!expanded && summary && (
            <span className="text-[11px] text-emerald-600 font-medium shrink-0 ml-auto pr-1">{summary}</span>
          )}
        </button>
        {expanded
          ? <ChevronUp size={13} className="text-emerald-400 shrink-0 cursor-pointer" onClick={() => setExpanded(false)} />
          : <ChevronDown size={13} className="text-emerald-400 shrink-0 cursor-pointer" onClick={() => setExpanded(true)} />}
        <button type="button" onClick={onRemove} className="shrink-0 pl-0.5">
          <X size={12} className="text-gray-400 hover:text-red-500" />
        </button>
      </div>

      {/* Expanded inputs */}
      {expanded && (
        <div className="px-2 pb-2 pt-1.5 border-t border-emerald-200 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 basis-12 flex flex-col gap-0.5">
              <p className="text-[10px] font-medium text-emerald-700 leading-none">{labelSets}</p>
              <input
                type="text" inputMode="numeric" value={ex.sets || ''}
                onFocus={e => e.target.select()}
                onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '')); onUpdate('sets', isNaN(v) ? 0 : v) }}
                className="h-6 w-full rounded border border-emerald-200 bg-white px-2 text-xs focus:outline-none focus:border-emerald-400" />
            </div>
            <div className="flex-1 basis-14 flex flex-col gap-0.5">
              <p className="text-[10px] font-medium text-emerald-700 leading-none">{isEndurance ? t('durationLabel') : t('reps')}</p>
              <input
                value={ex.reps}
                onFocus={e => e.target.select()}
                onChange={e => onUpdate('reps', e.target.value)}
                placeholder={isEndurance ? '2min' : '8-12'}
                className="h-6 w-full rounded border border-emerald-200 bg-white px-2 text-xs focus:outline-none focus:border-emerald-400" />
            </div>
            <div className="flex-1 basis-14 flex flex-col gap-0.5">
              <p className="text-[10px] font-medium text-emerald-700 leading-none">{labelRest}</p>
              <input
                type="text" inputMode="numeric" value={ex.rest_seconds || ''}
                onFocus={e => e.target.select()}
                onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '')); onUpdate('rest_seconds', isNaN(v) ? 0 : v) }}
                className="h-6 w-full rounded border border-emerald-200 bg-white px-2 text-xs focus:outline-none focus:border-emerald-400" />
            </div>
            {activeOptional.map(f => (
              <div key={f.key} className="flex-1 basis-12 flex flex-col gap-0.5">
                <p className="text-[10px] font-medium text-emerald-700 leading-none whitespace-nowrap">{f.label}{f.unit ? ` (${f.unit})` : ''}</p>
                <input
                  value={(ex as any)[f.key] ?? ''}
                  onFocus={e => e.target.select()}
                  onChange={e => onUpdate(f.key, e.target.value)}
                  placeholder="—"
                  className="h-6 w-full rounded border border-emerald-200 bg-white px-2 text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>
            ))}
          </div>

          <input
            value={ex.notes}
            onChange={e => onUpdate('notes', e.target.value)}
            placeholder={labelNotes}
            className="h-6 w-full rounded border border-emerald-200 bg-white px-2 text-xs text-gray-600 placeholder:text-gray-400 focus:outline-none focus:border-emerald-400" />
        </div>
      )}
    </div>
  )
}
