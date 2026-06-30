'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, GripVertical, Search, ExternalLink, LayoutList, Plus, ChevronDown, ChevronUp, PlayCircle, ImageIcon, Layers } from 'lucide-react'
import { useTrainerSettings, EXERCISE_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useAppTheme } from '@/app/contexts/app-theme'
import AddExerciseDialog, { type CreatedExercise } from './add-exercise-dialog'
import ExerciseMediaPreview from '../components/exercise-media-preview'
import BlockCard from '../components/block-card'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { snapCenterToCursor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  type TemplateItem, type TemplateExercise, type TemplateBlock, type ExerciseOption,
  isBlock, getAllUsedExerciseIds, getItemDndId, createEmptyBlock, exerciseFromOption, migrateLegacy,
} from '../lib/template-blocks'

type Template = {
  id: string; name: string; description: string; exercises: any[]
}

type Props = { template: Template; open: boolean; onClose: () => void; onSuccess: () => void; onExerciseCreated?: () => void }

// ─── Sortable standalone exercise item ────────────────────────────────────────
function SortableItem({
  ex, index, extraFields, blocks, onUpdate, onUpdateExtra, onRemove, onPreview, onMoveToBlock, isNew, isDark,
}: {
  ex: TemplateExercise
  index: number
  extraFields: typeof EXERCISE_FIELD_OPTIONS
  blocks: TemplateBlock[]
  onUpdate: (field: string, value: any) => void
  onUpdateExtra: (key: string, value: string) => void
  onRemove: () => void
  onPreview: () => void
  onMoveToBlock: (targetId: string | 'new') => void
  isNew?: boolean
  isDark?: boolean
}) {
  const t = useTranslations('training.dialogs.template')
  const [expanded, setExpanded] = useState(true)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const moveMenuRef = useRef<HTMLDivElement>(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.exercise_id })

  useEffect(() => {
    if (!showMoveMenu) return
    const handle = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) setShowMoveMenu(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showMoveMenu])

  const summary = [
    ex.sets ? `${ex.sets}×${ex.reps || '—'}` : null,
    ex.rest_seconds ? `${ex.rest_seconds}s` : null,
  ].filter(Boolean).join(' · ')

  const isWarmup = ex.section === 'warmup'
  const palette = isWarmup
    ? { border: isDark ? 'border-amber-800/60' : 'border-amber-300', bg: isDark ? 'bg-amber-900/10' : 'bg-amber-50/60', grip: 'text-amber-300 hover:text-amber-500', numBg: isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-200 text-amber-700', chevron: 'text-amber-400', summary: 'text-amber-600', divider: isDark ? 'border-amber-800/40' : 'border-amber-200', inputBorder: isDark ? 'border-amber-800/40 focus:border-amber-600' : 'border-amber-200 focus:border-amber-400', text: isDark ? 'text-amber-400' : 'text-amber-700', iconHover: 'hover:text-amber-500', inputBg: isDark ? 'bg-white/[0.05]' : 'bg-white', noteBg: isDark ? 'bg-white/[0.05]' : 'bg-white' }
    : { border: isDark ? 'border-emerald-800/60' : 'border-emerald-300', bg: isDark ? 'bg-emerald-900/10' : 'bg-emerald-50', grip: 'text-emerald-300 hover:text-emerald-500', numBg: isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-200 text-emerald-700', chevron: 'text-emerald-400', summary: 'text-emerald-600', divider: isDark ? 'border-emerald-800/40' : 'border-emerald-200', inputBorder: isDark ? 'border-emerald-800/40 focus:border-emerald-600' : 'border-emerald-200 focus:border-emerald-400', text: isDark ? 'text-emerald-400' : 'text-emerald-700', iconHover: 'hover:text-emerald-500', inputBg: isDark ? 'bg-white/[0.05]' : 'bg-white', noteBg: isDark ? 'bg-white/[0.05]' : 'bg-white' }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`border ${palette.border} rounded-lg ${palette.bg} overflow-hidden ${isNew ? 'item-added' : ''}`}
    >
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button
          type="button" {...listeners} {...attributes}
          className={`cursor-grab active:cursor-grabbing ${palette.grip} shrink-0 touch-none transition-colors`}
          tabIndex={-1}
          title={t('dragHandleTitle')}
        >
          <GripVertical size={15} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <div className={`w-5 h-5 rounded-full ${palette.numBg} text-[10px] font-bold flex items-center justify-center shrink-0`}>
            {index + 1}
          </div>
          <span className={`text-sm font-semibold flex-1 truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{ex.name}</span>
          {isWarmup && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 font-medium ${isDark ? 'bg-amber-900/30 text-amber-400 border-amber-800/40' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
              🔥 {t('warmupBadge')}
            </span>
          )}
          {!expanded && summary && (
            <span className={`text-[11px] ${palette.summary} font-medium shrink-0 pr-1`}>{summary}</span>
          )}
        </button>

        {/* Media preview */}
        {(() => {
          const hasUpload = ex.media_type === 'video' || ex.media_type === 'image'
          const hasYoutube = !hasUpload && !!ex.video_url
          if (!hasUpload && !hasYoutube) return null
          const Icon = ex.media_type === 'image' ? ImageIcon : ex.media_type === 'video' ? PlayCircle : ExternalLink
          return (
            <button type="button" onClick={e => { e.stopPropagation(); onPreview() }}
              className={`text-gray-400 ${palette.iconHover} transition-colors shrink-0 p-1`} title="Video">
              <Icon size={12} />
            </button>
          )
        })()}

        {/* Move to block */}
        <div className="relative shrink-0" ref={moveMenuRef}>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowMoveMenu(v => !v) }}
            className={`p-1 rounded transition-colors ${isDark ? 'text-gray-600 hover:text-violet-400 hover:bg-violet-900/20' : 'text-gray-300 hover:text-violet-500 hover:bg-violet-50'}`}
            title={t('moveToBlock')}
          >
            <Layers size={12} />
          </button>
          {showMoveMenu && (
            <div className={`absolute right-0 top-full mt-1 z-50 min-w-[10rem] border rounded-xl shadow-xl overflow-hidden ${
              isDark ? 'border-white/10 bg-[oklch(0.18_0.018_264)]' : 'border-gray-100 bg-white'
            }`}>
              <p className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border-b ${isDark ? 'text-gray-500 border-white/8' : 'text-gray-400 border-gray-100'}`}>
                {t('moveToBlockMenu')}
              </p>
              {blocks.map((b, bi) => (
                <button key={b.block_id} type="button"
                  onMouseDown={ev => ev.preventDefault()}
                  onClick={() => { onMoveToBlock(b.block_id); setShowMoveMenu(false) }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${isDark ? 'text-gray-300 hover:bg-white/[0.06]' : 'text-gray-700 hover:bg-violet-50'}`}
                >
                  {b.label || t('blockLabel', { index: bi + 1 })}
                  <span className={`ml-1 text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    ({b.exercises.length} {t('exercisesShort')})
                  </span>
                </button>
              ))}
              <div className={`border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                <button type="button"
                  onMouseDown={ev => ev.preventDefault()}
                  onClick={() => { onMoveToBlock('new'); setShowMoveMenu(false) }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-1.5 font-medium transition-colors ${isDark ? 'text-violet-400 hover:bg-violet-900/20' : 'text-violet-600 hover:bg-violet-50'}`}
                >
                  <Plus size={11} /> {t('newBlock')}
                </button>
              </div>
            </div>
          )}
        </div>

        {expanded
          ? <ChevronUp size={13} className={`${palette.chevron} shrink-0 cursor-pointer`} onClick={() => setExpanded(false)} />
          : <ChevronDown size={13} className={`${palette.chevron} shrink-0 cursor-pointer`} onClick={() => setExpanded(true)} />}
        <button type="button" onClick={onRemove}
          className={`shrink-0 p-1 rounded transition-colors ${isDark ? 'text-gray-600 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
          title={t('removeExerciseHandleTitle')}>
          <X size={13} />
        </button>
      </div>

      {expanded && (
        <div className={`px-2 pb-2 pt-1.5 border-t ${palette.divider} space-y-1.5`}>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 basis-12 flex flex-col gap-0.5">
              <p className={`text-[10px] font-medium ${palette.text} leading-none`}>{t('sets')}</p>
              <input
                type="text" inputMode="numeric" value={ex.sets || ''}
                onFocus={e => e.target.select()}
                onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '')); onUpdate('sets', isNaN(v) ? 0 : v) }}
                className={`h-6 w-full rounded border ${palette.inputBorder} ${palette.inputBg} px-2 text-xs focus:outline-none ${isDark ? 'text-gray-200 placeholder:text-gray-600' : ''}`} />
            </div>
            <div className="flex-1 basis-14 flex flex-col gap-0.5">
              <p className={`text-[10px] font-medium ${palette.text} leading-none`}>{t('repsLabel')}</p>
              <input
                value={ex.reps}
                onFocus={e => e.target.select()}
                onChange={e => onUpdate('reps', e.target.value)}
                placeholder="8-12"
                className={`h-6 w-full rounded border ${palette.inputBorder} ${palette.inputBg} px-2 text-xs focus:outline-none ${isDark ? 'text-gray-200 placeholder:text-gray-600' : ''}`} />
            </div>
            <div className="flex-1 basis-14 flex flex-col gap-0.5">
              <p className={`text-[10px] font-medium ${palette.text} leading-none`}>{t('restSecsLabel')}</p>
              <input
                type="text" inputMode="numeric" value={ex.rest_seconds || ''}
                onFocus={e => e.target.select()}
                onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '')); onUpdate('rest_seconds', isNaN(v) ? 0 : v) }}
                className={`h-6 w-full rounded border ${palette.inputBorder} ${palette.inputBg} px-2 text-xs focus:outline-none ${isDark ? 'text-gray-200 placeholder:text-gray-600' : ''}`} />
            </div>
            {extraFields.map(f => (
              <div key={f.key} className="flex-1 basis-12 flex flex-col gap-0.5">
                <p className={`text-[10px] font-medium ${palette.text} leading-none whitespace-nowrap`}>{f.label}{f.unit ? ` (${f.unit})` : ''}</p>
                <input
                  value={ex.extras?.[f.key] || ''}
                  onFocus={e => e.target.select()}
                  onChange={e => onUpdateExtra(f.key, e.target.value)}
                  placeholder="—"
                  className={`h-6 w-full rounded border ${palette.inputBorder} ${palette.inputBg} px-2 text-xs focus:outline-none ${isDark ? 'text-gray-200 placeholder:text-gray-600' : ''}`}
                />
              </div>
            ))}
          </div>
          <input
            value={ex.notes}
            onChange={e => onUpdate('notes', e.target.value)}
            placeholder={t('notePlaceholder')}
            className={`h-6 w-full rounded border ${palette.inputBorder} ${palette.noteBg} px-2 text-xs focus:outline-none ${isDark ? 'text-gray-400 placeholder:text-gray-600' : 'text-gray-600 placeholder:text-gray-400'}`}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main dialog ───────────────────────────────────────────────────────────────
export default function EditTemplateDialog({ template, open, onClose, onSuccess, onExerciseCreated }: Props) {
  const t = useTranslations('training.dialogs.template')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description || '')
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([])
  const [selected, setSelected] = useState<TemplateItem[]>(() =>
    migrateLegacy((template.exercises || []).map((e: any) => ({ ...e, extras: e.extras || {} })))
  )
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [dropdownIndex, setDropdownIndex] = useState(-1)
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [previewExercise, setPreviewExercise] = useState<TemplateExercise | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const exercisesEndRef = useRef<HTMLDivElement>(null)
  const wasAlreadyFocusedRef = useRef(false)

  const extraFields = EXERCISE_FIELD_OPTIONS.filter(f =>
    settings.exerciseFields.includes(f.key) && !['rest'].includes(f.key)
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (open) {
      setName(template.name)
      setDescription(template.description || '')
      setSelected(migrateLegacy((template.exercises || []).map((e: any) => ({ ...e, extras: e.extras || {} }))))
      setSearch(''); setError('')
      fetchExercises()
    }
  }, [open, template.id])

  const fetchExercises = async () => {
    setExercisesLoaded(false)
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    const query = supabase.from('exercises')
      .select('id,name,category,muscle_group,primary_muscles,video_url,exercise_type,is_default,trainer_id,section,media_type,media_path')
      .order('name')
    const { data } = uid
      ? await query.or(`trainer_id.eq.${uid},is_default.eq.true`)
      : await query.eq('is_default', true)
    setExercisesLoaded(true)
    if (data) setExerciseOptions(data)
  }

  const allUsedIds = useMemo(() => getAllUsedExerciseIds(selected), [selected])
  const blocks = useMemo(() => selected.filter(isBlock) as TemplateBlock[], [selected])

  const filteredExercises = exerciseOptions.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    !allUsedIds.has(e.id)
  )

  const showDropdown = searchFocused || search.length > 0
  const [flashId, setFlashId] = useState<string | null>(null)

  // ── Root exercise management ──
  const addExercise = useCallback((exercise: ExerciseOption) => {
    if (allUsedIds.has(exercise.id)) return
    const { sets, reps, rest_seconds, ...optionalDefaults } = settings.workoutDefaults
    const extras: Record<string, string> = {}
    settings.exerciseFields.forEach(key => {
      if (optionalDefaults[key as keyof typeof optionalDefaults]) extras[key] = String(optionalDefaults[key as keyof typeof optionalDefaults])
    })
    setSelected(prev => [...prev, exerciseFromOption(exercise, { sets, reps, rest_seconds })])
    setFlashId(exercise.id)
    setTimeout(() => setFlashId(null), 1400)
    setSearch('')
    setDropdownIndex(-1)
    searchRef.current?.focus()
    setTimeout(() => exercisesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }, [allUsedIds, settings])

  const addBlock = useCallback(() => {
    const blockCount = selected.filter(isBlock).length
    setSelected(prev => [...prev, createEmptyBlock(blockCount)])
    setTimeout(() => exercisesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }, [selected])

  const removeItem = (id: string) =>
    setSelected(prev => prev.filter(item => getItemDndId(item) !== id))

  const updateExercise = (exercise_id: string, field: string, value: any) =>
    setSelected(prev => prev.map(item =>
      !isBlock(item) && item.exercise_id === exercise_id ? { ...item, [field]: value } : item
    ))

  const updateExtra = (exercise_id: string, key: string, value: string) =>
    setSelected(prev => prev.map(item =>
      !isBlock(item) && item.exercise_id === exercise_id
        ? { ...item, extras: { ...item.extras, [key]: value } } : item
    ))

  // ── Block management ──
  const updateBlock = useCallback((blockId: string, field: keyof TemplateBlock, value: any) => {
    setSelected(prev => prev.map(item =>
      isBlock(item) && item.block_id === blockId ? { ...item, [field]: value } : item
    ))
  }, [])

  const addExerciseToBlock = useCallback((blockId: string, exercise: ExerciseOption) => {
    setSelected(prev => prev.map(item => {
      if (!isBlock(item) || item.block_id !== blockId) return item
      return { ...item, exercises: [...item.exercises, exerciseFromOption(exercise, settings.workoutDefaults, true)] }
    }))
  }, [settings])

  const updateExerciseInBlock = useCallback((blockId: string, exerciseId: string, field: string, value: any) => {
    setSelected(prev => prev.map(item => {
      if (!isBlock(item) || item.block_id !== blockId) return item
      return { ...item, exercises: item.exercises.map(e => e.exercise_id === exerciseId ? { ...e, [field]: value } : e) }
    }))
  }, [])

  const removeExerciseFromBlock = useCallback((blockId: string, exerciseId: string) => {
    setSelected(prev => prev.map(item => {
      if (!isBlock(item) || item.block_id !== blockId) return item
      return { ...item, exercises: item.exercises.filter(e => e.exercise_id !== exerciseId) }
    }))
  }, [])

  const removeBlock = useCallback((blockId: string) => {
    setSelected(prev => prev.filter(item => !(isBlock(item) && item.block_id === blockId)))
  }, [])

  const moveExerciseOut = useCallback((blockId: string, exerciseId: string) => {
    setSelected(prev => {
      const blockIdx = prev.findIndex(item => isBlock(item) && (item as TemplateBlock).block_id === blockId)
      if (blockIdx === -1) return prev
      const block = prev[blockIdx] as TemplateBlock
      const ex = block.exercises.find(e => e.exercise_id === exerciseId)
      if (!ex) return prev
      const newBlock: TemplateBlock = { ...block, exercises: block.exercises.filter(e => e.exercise_id !== exerciseId) }
      const restored: TemplateExercise = { ...ex, sets: settings.workoutDefaults.sets, rest_seconds: settings.workoutDefaults.rest_seconds }
      const next = [...prev]
      next[blockIdx] = newBlock
      next.splice(blockIdx + 1, 0, restored)
      return next
    })
  }, [settings])

  const moveExerciseToBlock = useCallback((exerciseId: string, targetBlockId: string | 'new') => {
    setSelected(prev => {
      const exIdx = prev.findIndex(item => !isBlock(item) && (item as TemplateExercise).exercise_id === exerciseId)
      if (exIdx === -1) return prev
      const ex = prev[exIdx] as TemplateExercise
      let next = prev.filter((_, i) => i !== exIdx)

      if (targetBlockId === 'new') {
        const blockCount = next.filter(isBlock).length
        const newBlock = createEmptyBlock(blockCount)
        newBlock.exercises = [{ ...ex, sets: 0, rest_seconds: 0 }]
        next = [...next.slice(0, exIdx), newBlock, ...next.slice(exIdx)]
      } else {
        next = next.map(item => {
          if (!isBlock(item) || item.block_id !== targetBlockId) return item
          return { ...item, exercises: [...item.exercises, { ...ex, sets: 0, rest_seconds: 0 }] }
        })
      }
      return next
    })
  }, [])

  // ── DnD ──
  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string)

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (active.id !== over?.id) {
      setSelected(items => {
        const oldIndex = items.findIndex(i => getItemDndId(i) === active.id)
        const newIndex = items.findIndex(i => getItemDndId(i) === over!.id)
        if (oldIndex === -1 || newIndex === -1) return items
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredExercises.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropdownIndex(i => Math.min(i + 1, filteredExercises.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropdownIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && dropdownIndex >= 0) {
      e.preventDefault()
      addExercise(filteredExercises[dropdownIndex])
    } else if (e.key === 'Escape') {
      setSearchFocused(false)
      setDropdownIndex(-1)
    }
  }

  useEffect(() => {
    if (dropdownIndex >= 0 && dropdownRef.current) {
      const container = dropdownRef.current
      const item = container.children[dropdownIndex] as HTMLElement
      if (!item) return
      const itemTop = item.offsetTop
      const itemBot = itemTop + item.offsetHeight
      if (itemBot > container.scrollTop + container.clientHeight)
        container.scrollTop = itemBot - container.clientHeight
      else if (itemTop < container.scrollTop)
        container.scrollTop = itemTop
    }
  }, [dropdownIndex])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    // Validate blocks have ≥ 2 exercises
    const invalidBlocks = selected.filter(item => isBlock(item) && (item as TemplateBlock).exercises.length < 2)
    if (invalidBlocks.length > 0) {
      setError(t('blockNeedsExercises'))
      setLoading(false)
      return
    }

    const { error: saveError } = await supabase.from('workout_templates').update({
      name, description: description || null, exercises: selected,
    }).eq('id', template.id)

    if (saveError) { setError(saveError.message); setLoading(false); return }
    setLoading(false); onSuccess(); onClose()
  }

  const leafCount = useMemo(() => allUsedIds.size, [allUsedIds])

  return (
    <>
      <ConfirmDialog
        open={confirmRemove !== null}
        title={t('removeExerciseTitle')}
        description={t('removeExerciseConfirm')}
        onConfirm={() => { if (confirmRemove) removeItem(confirmRemove); setConfirmRemove(null) }}
        onCancel={() => setConfirmRemove(null)}
        confirmLabel={tCommon('remove')}
        destructive
      />
      <AddExerciseDialog
        open={showAddExercise}
        onClose={() => setShowAddExercise(false)}
        initialName={search}
        onSuccess={(exercise?: CreatedExercise) => {
          if (exercise) addExercise({ ...exercise, muscle_group: exercise.muscle_group ?? undefined, video_url: exercise.video_url ?? undefined })
          fetchExercises()
          onExerciseCreated?.()
          setTimeout(() => searchRef.current?.focus(), 100)
        }}
      />
      <ExerciseMediaPreview
        exercise={previewExercise}
        open={!!previewExercise}
        onClose={() => setPreviewExercise(null)}
      />
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 overflow-hidden" style={{ height: '90vh', background: isDark ? 'oklch(0.195 0.018 264)' : 'white' }} showCloseButton={false}>
          <DialogTitle className="sr-only">{t('editTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('editTitle')}</DialogDescription>

          {/* Colored header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 shrink-0 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <LayoutList size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base">{t('editTitle')}</h2>
              <p className="text-blue-100/70 text-xs truncate">{template.name}</p>
            </div>
            <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

            {/* Fixed: name + description */}
            <div className={`px-6 pt-4 pb-3 border-b shrink-0 ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-blue-50/30'}`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('name')}</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required className={`h-9 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200' : ''}`} />
                </div>
                <div className="space-y-1">
                  <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('description')}</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} className={`h-9 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600' : ''}`} />
                </div>
              </div>
            </div>

            {/* Fixed: search + add block button */}
            <div className={`px-6 py-3 border-b shrink-0 ${isDark ? 'bg-white/[0.02] border-white/8' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <Label className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('addExercise')}</Label>
                <button
                  type="button"
                  onClick={addBlock}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    isDark
                      ? 'border-violet-800/50 text-violet-400 hover:bg-violet-900/30 hover:border-violet-700'
                      : 'border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300'
                  }`}
                >
                  <Layers size={12} />
                  {t('addBlock')}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setDropdownIndex(-1) }}
                  onMouseDown={() => { wasAlreadyFocusedRef.current = document.activeElement === searchRef.current }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => { setSearchFocused(false); setDropdownIndex(-1) }, 150)}
                  onClick={() => {
                    if (wasAlreadyFocusedRef.current && showDropdown) {
                      setSearchFocused(false)
                      setSearch('')
                      setDropdownIndex(-1)
                      searchRef.current?.blur()
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t('searchAddPlaceholder')}
                  className={`pl-9 h-9 ${isDark ? 'bg-white/[0.05] border-white/10 text-gray-200 placeholder:text-gray-600 focus:border-blue-500' : 'border-blue-200 focus:border-blue-400'}`}
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus() }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}

                {showDropdown && (
                  <div className={`absolute top-full left-0 right-0 z-50 mt-1 border rounded-xl shadow-lg overflow-hidden ${isDark ? 'border-white/10 bg-[oklch(0.18_0.018_264)]' : 'border-blue-100 bg-white'}`}>
                    {!exercisesLoaded ? (
                      <p className="px-4 py-3 text-xs text-gray-400 text-center">{t('loadingExercises')}</p>
                    ) : (
                      <div ref={dropdownRef} className="overflow-y-auto max-h-52">
                        {filteredExercises.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-gray-400 text-center">
                            {search ? t('noResults', { search }) : t('allAdded')}
                          </p>
                        ) : filteredExercises.map((e, i) => {
                          const muscles = e.primary_muscles?.length ? e.primary_muscles : (e.muscle_group ? [e.muscle_group] : [])
                          return (
                            <button
                              key={e.id} type="button"
                              onMouseDown={ev => ev.preventDefault()}
                              onClick={() => addExercise(e)}
                              onMouseEnter={() => setDropdownIndex(i)}
                              className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm border-b last:border-0 transition-colors ${
                                dropdownIndex === i
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'border-white/5 hover:bg-white/[0.06] text-gray-200' : 'border-gray-50 hover:bg-blue-50'
                              }`}
                            >
                              <div>
                                <span className="font-medium">{e.name}</span>
                                {muscles.length > 0 && (
                                  <span className={`ml-2 text-xs ${dropdownIndex === i ? 'text-blue-200' : 'text-gray-400'}`}>{muscles.join(', ')}</span>
                                )}
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ml-2 ${dropdownIndex === i ? 'bg-blue-500 text-white border-blue-400' : isDark ? 'bg-white/[0.08] text-gray-400 border-white/10' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                {e.category}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <div className={`border-t px-3 py-2 ${isDark ? 'border-white/8 bg-white/[0.03]' : 'border-blue-50 bg-blue-50/40'}`}>
                      <button type="button"
                        onMouseDown={ev => ev.preventDefault()}
                        onClick={() => setShowAddExercise(true)}
                        className="w-full text-left text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 font-medium transition-colors">
                        <Plus size={12} />
                        {search ? t('createExercise', { search }) : t('createNewExercise')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable: exercises + blocks */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selected.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {t('exerciseCount', { count: leafCount })}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <GripVertical size={11} /> {t('dragHint')}
                    </span>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <SortableContext items={selected.map(getItemDndId)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {selected.map((item, index) => {
                          if (isBlock(item)) {
                            const blockIdx = selected.slice(0, index + 1).filter(isBlock).length - 1
                            return (
                              <BlockCard
                                key={item.block_id}
                                block={item}
                                blockIndex={blockIdx}
                                isDark={isDark}
                                exerciseOptions={exerciseOptions}
                                usedExerciseIds={allUsedIds}
                                onUpdateBlock={updateBlock}
                                onAddExerciseToBlock={addExerciseToBlock}
                                onUpdateExerciseInBlock={updateExerciseInBlock}
                                onRemoveExerciseFromBlock={removeExerciseFromBlock}
                                onRemoveBlock={removeBlock}
                                onMoveExerciseOut={moveExerciseOut}
                              />
                            )
                          }
                          const exVisualIdx = selected.slice(0, index + 1).filter(i => !isBlock(i)).length - 1
                          return (
                            <SortableItem
                              key={item.exercise_id}
                              ex={item}
                              index={exVisualIdx}
                              extraFields={extraFields}
                              blocks={blocks}
                              onUpdate={(field, value) => updateExercise(item.exercise_id, field, value)}
                              onUpdateExtra={(key, value) => updateExtra(item.exercise_id, key, value)}
                              onRemove={() => setConfirmRemove(item.exercise_id)}
                              onPreview={() => setPreviewExercise(item)}
                              onMoveToBlock={targetId => moveExerciseToBlock(item.exercise_id, targetId)}
                              isNew={flashId === item.exercise_id}
                              isDark={isDark}
                            />
                          )
                        })}
                      </div>
                    </SortableContext>
                    <div ref={exercisesEndRef} />
                    <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }} modifiers={[restrictToVerticalAxis]}>
                      {activeDragId && (() => {
                        const item = selected.find(i => getItemDndId(i) === activeDragId)
                        if (!item) return null
                        if (isBlock(item)) {
                          return (
                            <div className={`border-2 border-violet-400 rounded-xl px-3 py-2 shadow-xl text-sm font-semibold flex items-center gap-2 rotate-1 ${isDark ? 'bg-[oklch(0.22_0.018_264)] text-violet-300' : 'bg-white text-violet-700'}`}>
                              <Layers size={14} className="text-violet-400" />
                              {item.label || t('blockLabel', { index: 1 })}
                              <span className="text-xs font-normal opacity-60">{item.exercises.length} {t('exercisesShort')}</span>
                            </div>
                          )
                        }
                        return (
                          <div className={`border-2 border-blue-400 rounded-xl px-3 py-2 shadow-xl text-sm font-semibold flex items-center gap-2 rotate-1 ${isDark ? 'bg-[oklch(0.22_0.018_264)] text-gray-200' : 'bg-white text-gray-800'}`}>
                            <GripVertical size={14} className="text-blue-400" />
                            {item.name}
                          </div>
                        )
                      })()}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}

              {selected.length === 0 && !showDropdown && (
                <div className={`py-8 text-center border-2 border-dashed rounded-xl ${isDark ? 'border-white/10' : 'border-blue-100'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${isDark ? 'bg-white/[0.05]' : 'bg-blue-50'}`}>
                    <LayoutList size={18} className="text-blue-400" />
                  </div>
                  <p className="text-sm text-gray-400">{t('noExercises')}</p>
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {/* Sticky footer */}
            <div className={`px-6 py-4 border-t shrink-0 flex gap-3 ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-white'}`}>
              <Button type="button" variant="outline" onClick={onClose}
                className={`flex-1 ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/[0.05]' : ''}`}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={loading || !name}
                className="flex-1 bg-blue-600 hover:bg-blue-700">
                {loading ? tCommon('saving') : tCommon('saveChanges')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
