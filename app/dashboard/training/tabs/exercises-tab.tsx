'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
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
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Sve')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editExercise, setEditExercise] = useState<Exercise | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('trainer_id', user.id)
      .order('name')

    if (data) setExercises(data)
    setLoading(false)
  }

  const deleteExercise = async (id: string) => {
    await supabase.from('exercises').delete().eq('id', id)
    setExercises(exercises.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  const filtered = exercises.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.muscle_group?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'Sve' || e.category === activeCategory
    return matchSearch && matchCategory
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{exercises.length} vježbi</p>
        <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
          <Plus size={14} />
          Dodaj vježbu
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Pretraži vježbe..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Učitavanje...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {search ? 'Nema rezultata pretrage' : 'Još nemaš vježbi. Dodaj prvu!'}
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
                  <Badge variant="outline" className="text-xs">{exercise.category}</Badge>
                  {exercise.video_url && (
                    <a href={exercise.video_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
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

      <AddExerciseDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchExercises}
      />

      {editExercise && (
        <EditExerciseDialog
          exercise={editExercise}
          open={!!editExercise}
          onClose={() => setEditExercise(null)}
          onSuccess={() => {
            setEditExercise(null)
            fetchExercises()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Obriši vježbu"
        description="Sigurno želiš obrisati ovu vježbu? Ova radnja se ne može poništiti."
        onConfirm={() => confirmDelete && deleteExercise(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Obriši"
        destructive
      />
    </div>
  )
}