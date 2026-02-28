'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Dumbbell, ArrowUpDown } from 'lucide-react'
import AddTemplateDialog from './add-template-dialog'

type Template = {
  id: string
  name: string
  description: string
  exercises: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [sort, setSort] = useState<SortOption>('date_desc')

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('trainer_id', user.id)

    if (data) setTemplates(data)
    setLoading(false)
  }

  const sorted = [...templates].sort((a, b) => {
    if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'name_asc') return a.name.localeCompare(b.name)
    if (sort === 'name_desc') return b.name.localeCompare(a.name)
    return 0
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Predlošci treninga</h1>
          <p className="text-gray-500">{templates.length} ukupno predložaka</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
          <Plus size={16} />
          Novi predložak
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown size={14} className="text-gray-400" />
        <span className="text-sm text-gray-500">Sortiraj:</span>
        {[
          { value: 'date_desc', label: 'Najnoviji' },
          { value: 'date_asc', label: 'Najstariji' },
          { value: 'name_asc', label: 'A → Z' },
          { value: 'name_desc', label: 'Z → A' },
        ].map(option => (
          <Button
            key={option.value}
            variant={sort === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSort(option.value as SortOption)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Učitavanje...</p>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Još nemaš predložaka. Kreiraj prvi!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {sorted.map((template) => (
            <Card key={template.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Dumbbell size={16} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="font-medium">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-gray-500">{template.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{template.exercises?.length || 0} vježbi</span>
                  <Button variant="outline" size="sm">Uredi</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddTemplateDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchTemplates}
      />
    </div>
  )
}