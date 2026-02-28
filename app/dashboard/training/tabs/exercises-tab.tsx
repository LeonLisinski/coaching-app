'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search } from 'lucide-react'
import AddExerciseDialog from '../dialogs/add-exercise-dialog'

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
      .order('name', { ascending: true })

    if (data) setExercises(data)
    setLoading(false)
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
            <Card key={exercise.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-sm">{exercise.name}</p>
                    {exercise.muscle_group && (
                      <p className="text-xs text-gray-500">💪 {exercise.muscle_group}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{exercise.category}</Badge>
                  {exercise.video_url && (
                    <a href={exercise.video_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                      Video
                    </a>
                  )}
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
    </div>
  )
}