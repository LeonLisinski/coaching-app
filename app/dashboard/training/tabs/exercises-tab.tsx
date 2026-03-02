'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, X } from 'lucide-react'
import AddExerciseDialog from '../dialogs/add-exercise-dialog'
import EditExerciseDialog from '../dialogs/edit-exercise-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type Exercise = {
  id: string
  name: string
  category: string
  muscle_group: string
  description: string
  video_url: string
}

const CATEGORIES = ['Sve', 'Snaga', 'Kardio', 'Mobilnost', 'HIIT', 'Ostalo']

export default function ExercisesTab() {
  const t = useTranslations('training.exercisesTab')
  const tCommon = useTranslations('common')

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Sve')
  const [activeMuscle, setActiveMuscle] = useState('Sve')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editExercise, setEditExercise] = useState<Exercise | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchExercises() }, [])

  const fetchExercises = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('exercises').select('*').eq('trainer_id', user.id).order('name')
    if (data) setExercises(data)
    setLoading(false)
  }

  const deleteExercise = async (id: string) => {
    await supabase.from('exercises').delete().eq('id', id)
    setExercises(exercises.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  const muscleGroups = ['Sve', ...Array.from(new Set(
    exercises
      .flatMap(e => e.muscle_group?.split(',').map(m => m.trim()) || [])
      .filter(Boolean)
  )).sort()]

  const filtered = exercises.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.muscle_group?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'Sve' || e.category === activeCategory
    const matchMuscle = activeMuscle === 'Sve' ||
      e.muscle_group?.split(',').map(m => m.trim()).includes(activeMuscle)
    return matchSearch && matchCategory && matchMuscle
  })

  const activeFilterCount = [
    activeCategory !== 'Sve',
    activeMuscle !== 'Sve',
    search !== '',
  ].filter(Boolean).length

  const clearFilters = () => {
    setActiveCategory('Sve')
    setActiveMuscle('Sve')
    setSearch('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('count', { count: filtered.length })} / {t('count', { count: exercises.length })}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <SlidersHorizontal size={14} />
            {t('filterLabel')}
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
            <Plus size={14} />
            {t('add')}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showFilters && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('categoryHeader')}</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: 13,
                    fontWeight: activeCategory === cat ? 600 : 400,
                    backgroundColor: activeCategory === cat ? '#111827' : 'white',
                    color: activeCategory === cat ? 'white' : '#374151',
                    border: `1px solid ${activeCategory === cat ? '#111827' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}
                >
                  {cat === 'Sve' ? t('filterAll') : t(`categories.${cat}` as any)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('muscleGroupHeader')}</p>
            <div className="flex gap-2 flex-wrap">
              {muscleGroups.map(muscle => (
                <button
                  key={muscle}
                  onClick={() => setActiveMuscle(muscle)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: 13,
                    fontWeight: activeMuscle === muscle ? 600 : 400,
                    backgroundColor: activeMuscle === muscle ? '#6366f1' : 'white',
                    color: activeMuscle === muscle ? 'white' : '#374151',
                    border: `1px solid ${activeMuscle === muscle ? '#6366f1' : '#e5e7eb'}`,
                    cursor: 'pointer',
                  }}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              style={{ fontSize: 12, color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={12} />
              {t('clearAllFilters')}
            </button>
          )}
        </div>
      )}

      {activeFilterCount > 0 && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">{t('activeFilters')}</span>
          {activeCategory !== 'Sve' && (
            <button
              onClick={() => setActiveCategory('Sve')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: '#111827', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              {t(`categories.${activeCategory}` as any)} <X size={10} />
            </button>
          )}
          {activeMuscle !== 'Sve' && (
            <button
              onClick={() => setActiveMuscle('Sve')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 12, backgroundColor: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              {activeMuscle} <X size={10} />
            </button>
          )}
          <button
            onClick={clearFilters}
            style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            {t('clearAll')}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('noExercises')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((exercise) => (
            <Card
              key={exercise.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onDoubleClick={() => setEditExercise(exercise)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{exercise.name}</p>
                  {exercise.muscle_group && (
                    <p className="text-xs text-gray-500">💪 {exercise.muscle_group}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{t(`categories.${exercise.category}` as any)}</Badge>
                  {exercise.video_url && (
                    <a href={exercise.video_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                      Video
                    </a>
                  )}
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditExercise(exercise) }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(exercise.id) }}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
        title={t('deleteTitle')}
        description={t('deleteConfirm')}
        onConfirm={() => confirmDelete && deleteExercise(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('delete')}
        destructive
      />
    </div>
  )
}
