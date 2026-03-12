'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { X, GripVertical, Search, ExternalLink, LayoutList, Plus } from 'lucide-react'
import { useTrainerSettings, EXERCISE_FIELD_OPTIONS } from '@/hooks/use-trainer-settings'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddExerciseDialog, { type CreatedExercise } from './add-exercise-dialog'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = { open: boolean; onClose: () => void; onSuccess: () => void; onExerciseCreated?: () => void }

type ExerciseOption = {
  id: string
  name: string
  category: string
  primary_muscles?: string[]
  muscle_group?: string
  video_url?: string
}

type TemplateExercise = {
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes: string
  extras?: Record<string, string>
  video_url?: string
}

// ─── Sortable exercise item ────────────────────────────────────────────────────
function SortableItem({
  ex, index, extraFields, onUpdate, onUpdateExtra, onRemove,
}: {
  ex: TemplateExercise
  index: number
  extraFields: typeof EXERCISE_FIELD_OPTIONS
  onUpdate: (field: string, value: any) => void
  onUpdateExtra: (key: string, value: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.exercise_id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="border border-gray-100 rounded-xl p-3 space-y-2 bg-white shadow-sm hover:border-blue-200 transition-colors"
    >
      <div className="flex items-center gap-2">
        <button
          type="button" {...listeners} {...attributes}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-blue-400 shrink-0 touch-none transition-colors"
          tabIndex={-1}
          title="Povuci za promjenu redoslijeda"
        >
          <GripVertical size={15} />
        </button>
        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </div>
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{ex.name}</span>
        {ex.video_url && (
          <a href={ex.video_url} target="_blank" rel="noreferrer"
            className="text-gray-400 hover:text-blue-500 transition-colors shrink-0 p-1" title="Video">
            <ExternalLink size={12} />
          </a>
        )}
        <button type="button" onClick={onRemove}
          className="shrink-0 p-1 rounded hover:bg-red-50 transition-colors text-gray-300 hover:text-red-500"
          title="Ukloni vježbu">
          <X size={13} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 ml-7">
        <div>
          <Label className="text-[11px] text-gray-500 font-medium">Serije</Label>
          <Input type="number" value={ex.sets}
            onChange={e => onUpdate('sets', parseInt(e.target.value) || 0)}
            className="h-7 text-xs mt-0.5" />
        </div>
        <div>
          <Label className="text-[11px] text-gray-500 font-medium">Ponavljanja</Label>
          <Input value={ex.reps}
            onChange={e => onUpdate('reps', e.target.value)}
            placeholder="10 ili 8-12" className="h-7 text-xs mt-0.5" />
        </div>
        <div>
          <Label className="text-[11px] text-gray-500 font-medium">Odmor (sek)</Label>
          <Input type="number" value={ex.rest_seconds}
            onChange={e => onUpdate('rest_seconds', parseInt(e.target.value) || 0)}
            className="h-7 text-xs mt-0.5" />
        </div>
      </div>

      {extraFields.length > 0 && (
        <div className="grid grid-cols-3 gap-2 ml-7">
          {extraFields.map(f => (
            <div key={f.key}>
              <Label className="text-[11px] text-gray-500 font-medium">
                {f.label} {f.unit && <span className="text-gray-400">({f.unit})</span>}
              </Label>
              <Input
                value={ex.extras?.[f.key] || ''}
                onChange={e => onUpdateExtra(f.key, e.target.value)}
                placeholder={f.desc}
                className="h-7 text-xs mt-0.5"
              />
            </div>
          ))}
        </div>
      )}

      <textarea
        value={ex.notes}
        onChange={e => onUpdate('notes', e.target.value)}
        placeholder="Napomena..."
        rows={1}
        className="ml-7 w-[calc(100%-1.75rem)] border border-input rounded-md px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
      />
    </div>
  )
}

// ─── Main dialog ───────────────────────────────────────────────────────────────
export default function AddTemplateDialog({ open, onClose, onSuccess, onExerciseCreated }: Props) {
  const t = useTranslations('training.dialogs.template')
  const tCommon = useTranslations('common')
  const { settings } = useTrainerSettings()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selected, setSelected] = useState<TemplateExercise[]>([])
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [dropdownIndex, setDropdownIndex] = useState(-1)
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const extraFields = EXERCISE_FIELD_OPTIONS.filter(f =>
    settings.exerciseFields.includes(f.key) && !['rest'].includes(f.key)
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (open) { fetchExercises(); setName(''); setDescription(''); setSelected([]); setSearch(''); setError('') }
  }, [open])

  const fetchExercises = async () => {
    setExercisesLoaded(false)
    const { data } = await supabase.from('exercises').select('*').order('name')
    setExercisesLoaded(true)
    if (data) setExercises(data)
  }

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find(s => s.exercise_id === e.id)
  )

  // Dropdown shows when focused OR when there's text — in-flow (not absolute), so no overflow clipping
  const showDropdown = searchFocused || search.length > 0

  const addExercise = useCallback((exercise: ExerciseOption) => {
    if (selected.find(s => s.exercise_id === exercise.id)) return
    setSelected(prev => [...prev, {
      exercise_id: exercise.id,
      name: exercise.name,
      sets: 3, reps: '10', rest_seconds: 60, notes: '', extras: {},
      video_url: exercise.video_url || '',
    }])
    setSearch('')
    setDropdownIndex(-1)
    searchRef.current?.focus()
  }, [selected])

  const removeExercise = (exercise_id: string) =>
    setSelected(prev => prev.filter(s => s.exercise_id !== exercise_id))

  const updateExercise = (exercise_id: string, field: string, value: any) =>
    setSelected(prev => prev.map(s => s.exercise_id === exercise_id ? { ...s, [field]: value } : s))

  const updateExtra = (exercise_id: string, key: string, value: string) =>
    setSelected(prev => prev.map(s => s.exercise_id === exercise_id
      ? { ...s, extras: { ...s.extras, [key]: value } } : s))

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string)

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (active.id !== over?.id) {
      setSelected(items => {
        const oldIndex = items.findIndex(i => i.exercise_id === active.id)
        const newIndex = items.findIndex(i => i.exercise_id === over!.id)
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
      const item = dropdownRef.current.children[dropdownIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [dropdownIndex])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('workout_templates').insert({
      trainer_id: user.id, name, description: description || null, exercises: selected,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onSuccess(); onClose()
  }

  return (
    <>
      <ConfirmDialog
        open={confirmRemove !== null}
        title={t('removeExerciseTitle')}
        description={t('removeExerciseConfirm')}
        onConfirm={() => { if (confirmRemove) removeExercise(confirmRemove); setConfirmRemove(null) }}
        onCancel={() => setConfirmRemove(null)}
        confirmLabel="Ukloni"
        destructive
      />
      <AddExerciseDialog
        open={showAddExercise}
        onClose={() => setShowAddExercise(false)}
        onSuccess={(exercise?: CreatedExercise) => {
          if (exercise) addExercise({ ...exercise, muscle_group: exercise.muscle_group ?? undefined, video_url: exercise.video_url ?? undefined })
          fetchExercises()
          onExerciseCreated?.()
          setTimeout(() => searchRef.current?.focus(), 100)
        }}
      />
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 overflow-hidden" style={{ height: '90vh' }} showCloseButton={false}>
          <DialogTitle className="sr-only">{t('addTitle')}</DialogTitle>

          {/* Colored header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 shrink-0 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <LayoutList size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base">{t('addTitle')}</h2>
              <p className="text-blue-100/70 text-xs">{t('addSubtitle')}</p>
            </div>
            <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

            {/* Fixed: name + description */}
            <div className="px-6 pt-4 pb-3 border-b shrink-0 bg-blue-50/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">{t('name')}</Label>
                  <Input value={name} onChange={e => setName(e.target.value)}
                    placeholder={t('namePlaceholder')} required className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">{t('description')}</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={t('descriptionPlaceholder')} className="h-9" />
                </div>
              </div>
            </div>

            {/* Scrollable content: search + exercises */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

              {/* Exercise search — dropdown is IN-FLOW (not absolute) so overflow-y-auto won't clip it */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-600">{t('addExercise')}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                  <Input
                    ref={searchRef}
                    value={search}
                    onChange={e => { setSearch(e.target.value); setDropdownIndex(-1) }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => { setSearchFocused(false); setDropdownIndex(-1) }, 150)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Pretraži i dodaj vježbu... (↑↓ Enter)"
                    className="pl-9 h-9 border-blue-200 focus:border-blue-400"
                  />
                  {search && (
                    <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus() }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* IN-FLOW dropdown — no absolute positioning, no overflow clipping */}
                {showDropdown && (
                  <div ref={dropdownRef} className="border border-blue-100 rounded-xl bg-white shadow-md overflow-hidden">
                    {!exercisesLoaded ? (
                      <p className="px-4 py-3 text-xs text-gray-400 text-center">{t('loadingExercises')}</p>
                    ) : (
                      <div className="overflow-y-auto max-h-44">
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
                              className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm border-b border-gray-50 last:border-0 transition-colors ${
                                dropdownIndex === i ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div>
                                <span className="font-medium">{e.name}</span>
                                {muscles.length > 0 && (
                                  <span className="ml-2 text-xs text-gray-400">{muscles.join(', ')}</span>
                                )}
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200 shrink-0 ml-2">
                                {e.category}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {/* Create new exercise option */}
                    <div className="border-t border-blue-50 bg-blue-50/40 px-3 py-2">
                      <button
                        type="button"
                        onMouseDown={ev => ev.preventDefault()}
                        onClick={() => setShowAddExercise(true)}
                        className="w-full text-left text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1.5 py-0.5 font-medium transition-colors"
                      >
                        <Plus size={12} />
                        {search ? t('createExercise', { search }) : t('createNewExercise')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sortable exercise list */}
              {selected.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">
                      {t('exerciseCount', { count: selected.length })}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <GripVertical size={11} /> {t('dragHint')}
                    </span>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <SortableContext items={selected.map(s => s.exercise_id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {selected.map((ex, index) => (
                          <SortableItem
                            key={ex.exercise_id}
                            ex={ex}
                            index={index}
                            extraFields={extraFields}
                            onUpdate={(field, value) => updateExercise(ex.exercise_id, field, value)}
                            onUpdateExtra={(key, value) => updateExtra(ex.exercise_id, key, value)}
                            onRemove={() => setConfirmRemove(ex.exercise_id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                      {activeDragId && (() => {
                        const ex = selected.find(s => s.exercise_id === activeDragId)
                        if (!ex) return null
                        return (
                          <div className="border-2 border-blue-400 rounded-xl px-3 py-2 bg-white shadow-xl text-sm font-semibold text-gray-800 flex items-center gap-2 rotate-1">
                            <GripVertical size={14} className="text-blue-400" />
                            {ex.name}
                          </div>
                        )
                      })()}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}

              {selected.length === 0 && !showDropdown && (
                <div className="py-8 text-center border-2 border-dashed border-blue-100 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
                    <LayoutList size={18} className="text-blue-400" />
                  </div>
                  <p className="text-sm text-gray-400">{t('noExercises')}</p>
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {/* Sticky footer */}
            <div className="px-6 py-4 border-t bg-white shrink-0 flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={loading || !name || selected.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700">
                {loading ? tCommon('saving') : t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

