'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, X, ChevronDown, ChevronRight } from 'lucide-react'
import AddExerciseDialog from '../dialogs/add-exercise-dialog'
import EditExerciseDialog from '../dialogs/edit-exercise-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'

export type Exercise = {
  id: string
  name: string
  category: string
  muscle_group: string
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

type SortKey = 'name_asc' | 'name_desc'

export default function ExercisesTab() {
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

  useEffect(() => { fetchExercises() }, [])

  const fetchExercises = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
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

  const sorted = [...exercises].sort((a, b) =>
    sortKey === 'name_asc' ? a.name.localeCompare(b.name, 'hr') : b.name.localeCompare(a.name, 'hr')
  )

  const filtered = sorted.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.muscle_group?.toLowerCase().includes(search.toLowerCase())
    const matchEquipment = activeEquipment === 'Sve' || e.category === activeEquipment
    const matchMuscle = activeMuscle === 'Sve' || e.muscle_group === activeMuscle
    const matchMine = !showOnlyMine || !e.is_default
    return matchSearch && matchEquipment && matchMuscle && matchMine
  })

  const activeFilterCount = [activeEquipment !== 'Sve', activeMuscle !== 'Sve', showOnlyMine, sortKey !== 'name_asc'].filter(Boolean).length

  const clearFilters = () => { setActiveEquipment('Sve'); setActiveMuscle('Sve'); setShowOnlyMine(false); setSortKey('name_asc') }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{filtered.length} / {exercises.length} vježbi</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
            <SlidersHorizontal size={14} />
            Filtriraj
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
            <Plus size={14} /> Dodaj
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input placeholder="Pretraži vježbe..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mišićna grupa</p>
            <div className="flex gap-2 flex-wrap">
              {['Sve', ...MUSCLE_GROUPS].map(m => (
                <button key={m} onClick={() => setActiveMuscle(m)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 13,
                    fontWeight: activeMuscle === m ? 600 : 400,
                    backgroundColor: activeMuscle === m ? '#6366f1' : 'white',
                    color: activeMuscle === m ? 'white' : '#374151',
                    border: `1px solid ${activeMuscle === m ? '#6366f1' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Oprema</p>
            <div className="flex gap-2 flex-wrap">
              {['Sve', ...EQUIPMENT_CATEGORIES].map(eq => (
                <button key={eq} onClick={() => setActiveEquipment(eq)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 13,
                    fontWeight: activeEquipment === eq ? 600 : 400,
                    backgroundColor: activeEquipment === eq ? '#111827' : 'white',
                    color: activeEquipment === eq ? 'white' : '#374151',
                    border: `1px solid ${activeEquipment === eq ? '#111827' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}>
                  {eq}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sortiraj po</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'name_asc', label: 'Naziv A→Z' },
                { key: 'name_desc', label: 'Naziv Z→A' },
              ] as const).map(opt => (
                <button key={opt.key} onClick={() => setSortKey(opt.key)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 13,
                    fontWeight: sortKey === opt.key ? 600 : 400,
                    backgroundColor: sortKey === opt.key ? '#111827' : 'white',
                    color: sortKey === opt.key ? 'white' : '#374151',
                    border: `1px solid ${sortKey === opt.key ? '#111827' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Samo moje vježbe</p>
            <button onClick={() => setShowOnlyMine(!showOnlyMine)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${showOnlyMine ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${showOnlyMine ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-red-500 flex items-center gap-1">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Aktivni filteri:</span>
          {activeMuscle !== 'Sve' && (
            <button onClick={() => setActiveMuscle('Sve')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}>
              {activeMuscle} <X size={10} />
            </button>
          )}
          {activeEquipment !== 'Sve' && (
            <button onClick={() => setActiveEquipment('Sve')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: '#111827', color: 'white', border: 'none', cursor: 'pointer' }}>
              {activeEquipment} <X size={10} />
            </button>
          )}
          {showOnlyMine && (
            <button onClick={() => setShowOnlyMine(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}>
              Samo moje <X size={10} />
            </button>
          )}
          {sortKey !== 'name_asc' && (
            <button onClick={() => setSortKey('name_asc')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: 'white', color: '#374151', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
              Sortirano <X size={10} />
            </button>
          )}
          <button onClick={clearFilters} style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
            Očisti sve
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-500 text-sm">Nema vježbi</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(ex => {
            const isExpanded = expandedId === ex.id

            return (
              <Card key={ex.id} className="hover:shadow-sm transition-shadow cursor-pointer"
                onDoubleClick={() => setEditExercise(ex)}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {ex.description ? (
                        <button onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : ex.id) }}
                          className="text-gray-400 hover:text-gray-600 shrink-0">
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      ) : <div className="w-3.5 shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm">{ex.name}</p>
                          {ex.is_default && <span className="text-xs text-gray-400">(default)</span>}
                          {ex.exercise_type === 'endurance' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">Izdržljivost</span>
                          )}
                        </div>
                        {ex.muscle_group && <p className="text-xs text-gray-500">💪 {ex.muscle_group}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">{ex.category}</Badge>
                      {ex.video_url && (
                        <a href={ex.video_url} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                          Video
                        </a>
                      )}
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditExercise(ex) }}>
                        <Pencil size={14} />
                      </Button>
                      {!ex.is_default && (
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setConfirmDelete(ex.id) }}>
                          <Trash2 size={14} className="text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {isExpanded && ex.description && (
                    <p className="text-xs text-gray-500 mt-2 ml-5 leading-relaxed">{ex.description}</p>
                  )}
                </CardContent>
              </Card>
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
        title="Obriši vježbu"
        description="Jesi li siguran da želiš obrisati ovu vježbu?"
        onConfirm={() => confirmDelete && deleteExercise(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('delete')}
        destructive
      />
    </div>
  )
}
