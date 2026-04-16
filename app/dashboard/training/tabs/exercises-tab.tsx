'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, X, ChevronDown, ChevronRight, ExternalLink, GripVertical, Dumbbell } from 'lucide-react'
import AddExerciseDialog from '../dialogs/add-exercise-dialog'
import EditExerciseDialog from '../dialogs/edit-exercise-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useDraggable } from '@dnd-kit/core'

export type Exercise = {
  id: string
  name: string
  category: string
  muscle_group: string
  primary_muscles: string[]
  secondary_muscles: string[]
  description: string
  video_url: string
  is_default: boolean
  trainer_id: string | null
  extras?: Record<string, string> | null
  exercise_type?: 'strength' | 'endurance'
}

export const EQUIPMENT_CATEGORIES = [
  'Slobodni utezi', 'Bučice', 'Kabel', 'Sprave',
  'Vlastita težina', 'Kettlebell', 'Ostalo',
]

export const MUSCLE_GROUPS = [
  'Prsa', 'Leđa', 'Ramena', 'Biceps', 'Triceps', 'Podlaktice',
  'Kvadricepsi', 'Stražnja loža', 'Gluteusi', 'Listovi', 'Trbuh', 'Cijelo tijelo',
]

type SortKey = 'name_asc' | 'name_desc' | 'mine_first'

// ─── Draggable exercise card ───────────────────────────────────────────────────
function DraggableExerciseCard({
  ex,
  children,
}: {
  ex: Exercise
  children: (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `exercise::${ex.id}`,
    data: {
      type: 'exercise',
      name: ex.name,
      subtitle: (ex.primary_muscles?.length ? ex.primary_muscles : (ex.muscle_group ? [ex.muscle_group] : [])).join(', '),
      payload: ex,
    },
  })
  return (
    // setNodeRef on the card — dnd-kit measures THIS element for drag position
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }} className="transition-opacity">
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

export default function ExercisesTab({ activeType, refreshKey }: { activeType?: 'exercise' | 'template' | null; refreshKey?: number }) {
  const t = useTranslations('training.exercisesTab')
  const tCommon = useTranslations('common')

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [activeEquipment, setActiveEquipment] = useState('Sve')
  const [activeMuscle, setActiveMuscle] = useState('Sve')
  const [showOnlyMine, setShowOnlyMine] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name_asc')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editExercise, setEditExercise] = useState<Exercise | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchExercises() }, [refreshKey])

  const fetchExercises = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const [{ data: allEx }, { data: overrides }] = await Promise.all([
      supabase.from('exercises').select('*').order('name'),
      supabase.from('trainer_overrides')
        .select('default_id')
        .eq('trainer_id', user.id)
        .eq('resource_type', 'exercise'),
    ])

    const overriddenIds = new Set((overrides || []).map(o => o.default_id))
    const visible = (allEx || []).filter(e =>
      (!e.is_default && e.trainer_id === user.id) ||
      (e.is_default && !overriddenIds.has(e.id))
    )
    setExercises(visible)
    setLoading(false)
  }

  const deleteExercise = async (id: string) => {
    await supabase.from('exercises').delete().eq('id', id)
    setExercises(prev => prev.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  const sorted = [...exercises].sort((a, b) => {
    if (sortKey === 'name_asc') return a.name.localeCompare(b.name, 'hr')
    if (sortKey === 'name_desc') return b.name.localeCompare(a.name, 'hr')
    if (sortKey === 'mine_first') return (a.is_default ? 1 : 0) - (b.is_default ? 1 : 0)
    return a.name.localeCompare(b.name, 'hr')
  })

  const filtered = sorted.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.muscle_group?.toLowerCase().includes(search.toLowerCase()) ||
      (e.primary_muscles || []).some(m => m.toLowerCase().includes(search.toLowerCase()))
    const matchEquipment = activeEquipment === 'Sve' || e.category === activeEquipment
    const matchMuscle = activeMuscle === 'Sve' ||
      (e.primary_muscles || []).includes(activeMuscle) ||
      e.muscle_group === activeMuscle
    const matchMine = !showOnlyMine || !e.is_default
    return matchSearch && matchEquipment && matchMuscle && matchMine
  })

  const activeFilterCount = [activeEquipment !== 'Sve', activeMuscle !== 'Sve', showOnlyMine, sortKey !== 'name_asc'].filter(Boolean).length
  const clearFilters = () => { setActiveEquipment('Sve'); setActiveMuscle('Sve'); setShowOnlyMine(false); setSortKey('name_asc') }

  const pillClass = (active: boolean, variant: 'indigo' | 'dark' | 'blue' = 'dark') => {
    const activeColors = {
      indigo: 'bg-emerald-600 text-white border-emerald-600',
      dark: 'bg-gray-800 text-white border-gray-800',
      blue: 'bg-emerald-500 text-white border-emerald-500',
    }
    return `text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer font-medium ${
      active ? activeColors[variant] : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
    }`
  }

  return (
    <>
      {/* Fixed: header + search */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 bg-white space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-xs">{filtered.length} / {t('count', { count: exercises.length })}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${activeFilterCount > 0 ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : ''}`}
            >
              <SlidersHorizontal size={12} />
              {t('filterButton')}
              {activeFilterCount > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm" className="h-7 text-xs flex items-center gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus size={12} /> {t('add')}
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`pl-9 h-9 text-sm ${search ? 'pr-8' : ''}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-emerald-50/60 rounded-xl p-3 space-y-3 border border-emerald-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('muscleGroupHeader')}</p>
            <div className="flex gap-1.5 flex-wrap">
              {['Sve', ...MUSCLE_GROUPS].map(m => (
                <button key={m} type="button" onClick={() => setActiveMuscle(m)}
                  className={pillClass(activeMuscle === m, 'indigo')}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('equipmentHeader')}</p>
            <div className="flex gap-1.5 flex-wrap">
              {['Sve', ...EQUIPMENT_CATEGORIES].map(eq => (
                <button key={eq} type="button" onClick={() => setActiveEquipment(eq)}
                  className={pillClass(activeEquipment === eq, 'dark')}>
                  {eq}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('sortByHeader')}</p>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'name_asc', label: t('sortAZ') },
                { key: 'name_desc', label: t('sortZA') },
                { key: 'mine_first', label: t('mineFirst') },
              ] as const).map(opt => (
                <button key={opt.key} type="button" onClick={() => setSortKey(opt.key)}
                  className={pillClass(sortKey === opt.key, 'dark')}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">{t('onlyMineToggle')}</p>
            <button type="button" onClick={() => setShowOnlyMine(!showOnlyMine)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${showOnlyMine ? 'bg-primary' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${showOnlyMine ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="text-xs text-rose-500 flex items-center gap-1">
              <X size={11} /> {tCommon('clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">{t('activeFiltersLabel')}</span>
          {activeMuscle !== 'Sve' && (
            <button type="button" onClick={() => setActiveMuscle('Sve')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-600 text-white">
              {activeMuscle} <X size={10} />
            </button>
          )}
          {activeEquipment !== 'Sve' && (
            <button type="button" onClick={() => setActiveEquipment('Sve')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-800 text-white">
              {activeEquipment} <X size={10} />
            </button>
          )}
          {showOnlyMine && (
            <button type="button" onClick={() => setShowOnlyMine(false)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500 text-white">
              {t('onlyMineChip')} <X size={10} />
            </button>
          )}
          {sortKey !== 'name_asc' && (
            <button type="button" onClick={() => setSortKey('name_asc')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-gray-200 text-gray-600 bg-white">
              {t('sortedChipZA')} <X size={10} />
            </button>
          )}
          <button type="button" onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600">
            {tCommon('clearFilters')}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed rounded-xl border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
            <Dumbbell size={20} className="text-emerald-400" />
          </div>
          <p className="text-gray-400 text-sm">{t('noFilterResults')}</p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
              {tCommon('clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(ex => {
            const isExpanded = expandedId === ex.id
            const primary = ex.primary_muscles?.length ? ex.primary_muscles : (ex.muscle_group ? [ex.muscle_group] : [])
            const secondary = ex.secondary_muscles || []

            return (
              <DraggableExerciseCard key={ex.id} ex={ex}>
                {(dragHandleProps) => (
                  <div
                    className="border border-gray-100 rounded-xl p-2.5 bg-white hover:shadow-sm hover:border-gray-200 transition-all cursor-default select-none"
                    onDoubleClick={() => setEditExercise(ex)}
                    title={t('dblClickHint')}
                  >
                    <div className="flex items-center gap-1.5">
                      {/* Drag handle — listeners on the grip, ref on the outer card div */}
                      <button
                        type="button"
                        {...dragHandleProps}
                        className="text-gray-300 hover:text-emerald-400 shrink-0 cursor-grab active:cursor-grabbing touch-none transition-colors"
                        title={t('dragTooltip')}
                      >
                        <GripVertical size={14} />
                      </button>

                      {ex.description ? (
                        <button type="button" onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                          className="text-gray-400 hover:text-gray-600 shrink-0">
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      ) : <div className="w-3.5 shrink-0" />}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm text-gray-800">{ex.name}</p>
                          {ex.is_default && <span className="text-[10px] text-gray-400">(default)</span>}
                          {ex.exercise_type === 'endurance' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                              {t('enduranceBadge')}
                            </span>
                          )}
                        </div>
                        {(primary.length > 0 || secondary.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {primary.map(m => (
                              <span key={m} className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium border border-emerald-100">
                                {m}
                              </span>
                            ))}
                            {secondary.map(m => (
                              <span key={m} className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded-full border border-gray-100">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-100 mr-1">{ex.category}</span>
                        {ex.video_url && (
                          <a href={ex.video_url} target="_blank" rel="noreferrer"
                            className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                            onClick={e => e.stopPropagation()} title="Video">
                            <ExternalLink size={12} />
                          </a>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700"
                          onClick={() => setEditExercise(ex)}>
                          <Pencil size={12} />
                        </Button>
                        {!ex.is_default && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                            onClick={() => setConfirmDelete(ex.id)}>
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && ex.description && (
                      <p className="text-xs text-gray-500 mt-2 ml-8 leading-relaxed">{ex.description}</p>
                    )}
                  </div>
                )}
              </DraggableExerciseCard>
            )
          })}
        </div>
      )}

      <AddExerciseDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchExercises} />
      {editExercise && (
        <EditExerciseDialog
          exercise={editExercise}
          open={!!editExercise}
          onClose={() => setEditExercise(null)}
          onSuccess={() => { setEditExercise(null); fetchExercises() }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title={tCommon('deleteExercise')}
        description={tCommon('deleteExerciseConfirm')}
        onConfirm={() => confirmDelete && deleteExercise(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('delete')}
        destructive
      />
      </div>
    </>
  )
}

