'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Dumbbell, Pencil, Trash2, GripVertical, PlusCircle, Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import AddTemplateDialog from '../dialogs/add-template-dialog'
import EditTemplateDialog from '../dialogs/edit-template-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useDraggable, useDroppable } from '@dnd-kit/core'

type Template = {
  id: string
  name: string
  description: string
  exercises: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'exercises_desc'

// ─── Template card: droppable (receives exercises) + draggable handle ──────────
function TemplateCard({
  template,
  activeType,
  onEdit,
  onDelete,
}: {
  template: Template
  activeType?: 'exercise' | 'template' | null
  onEdit: () => void
  onDelete: () => void
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `template-drop::${template.id}`,
    data: { type: 'template-drop', templateId: template.id },
  })

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `template::${template.id}`,
    data: {
      type: 'template',
      name: template.name,
      subtitle: `${template.exercises?.length ?? 0} vježbi`,
      payload: template,
    },
  })

  const showDropHint = activeType === 'exercise'
  const isActive = isOver && activeType === 'exercise'

  return (
    <div
      ref={setDropRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className={`relative border rounded-xl p-3 transition-all duration-150 bg-white cursor-default select-none ${
        isActive
          ? 'border-primary shadow-md ring-2 ring-primary/25 bg-primary/5'
          : showDropHint
          ? 'border-dashed border-primary/40'
          : 'border-gray-100 hover:shadow-sm hover:border-gray-200'
      }`}
      onDoubleClick={() => !isDragging && onEdit()}
    >
      {isActive && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-10">
          <div className="bg-primary/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <PlusCircle size={12} /> Dodaj vježbu
          </div>
        </div>
      )}

      <div className={`flex items-center gap-2 ${isActive ? 'opacity-30' : ''}`}>
        <button
          ref={setDragRef}
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-indigo-400 shrink-0 touch-none transition-colors"
          title="Povuci u plan"
          onDoubleClick={e => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>

        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Dumbbell size={12} className="text-blue-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate text-gray-800">{template.name}</p>
          {template.description && (
            <p className="text-xs text-gray-400 truncate">{template.description}</p>
          )}
          <p className="text-[10px] text-gray-300 mt-0.5">dvoklik za uređivanje</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onDoubleClick={e => e.stopPropagation()}>
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium border border-blue-100">
            {template.exercises?.length ?? 0} vj.
          </span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
            onClick={e => { e.stopPropagation(); onEdit() }}>
            <Pencil size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
            onClick={e => { e.stopPropagation(); onDelete() }}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {template.exercises?.length > 0 && !isActive && (
        <div className="flex flex-wrap gap-1 mt-2 ml-8">
          {template.exercises.slice(0, 5).map((ex: any) => (
            <span key={ex.exercise_id} className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-100">
              {ex.name}
            </span>
          ))}
          {template.exercises.length > 5 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100">
              +{template.exercises.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main tab ──────────────────────────────────────────────────────────────────
export default function TemplatesTab({ activeType, onExerciseCreated }: { activeType?: 'exercise' | 'template' | null; onExerciseCreated?: () => void }) {
  const t = useTranslations('training.templatesTab')
  const tCommon = useTranslations('common')

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('date_desc')
  const [minExercises, setMinExercises] = useState(0)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { fetchTemplates() }, [])

  const fetchTemplates = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { data } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('trainer_id', user.id)
    if (data) setTemplates(data)
    setLoading(false)
  }

  const deleteTemplate = async (id: string) => {
    await supabase.from('workout_templates').delete().eq('id', id)
    setTemplates(templates.filter(t => t.id !== id))
    setConfirmDelete(null)
  }

  const sorted = [...templates]
    .filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) &&
      (t.exercises?.length ?? 0) >= minExercises
    )
    .sort((a, b) => {
      if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'hr')
      if (sort === 'name_desc') return b.name.localeCompare(a.name, 'hr')
      if (sort === 'exercises_desc') return (b.exercises?.length ?? 0) - (a.exercises?.length ?? 0)
      return 0
    })

  const hasFilters = sort !== 'date_desc' || minExercises > 0

  return (
    <>
      {/* Fixed: header + search */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-gray-100 bg-white space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-xs">{sorted.length} / {templates.length} treninga</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${hasFilters ? 'border-blue-300 text-blue-600 bg-blue-50' : ''}`}
            >
              <SlidersHorizontal size={12} />
              Filtriraj
              {hasFilters && <span className="bg-blue-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
              <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm" className="h-7 text-xs flex items-center gap-1 px-2.5 bg-blue-600 hover:bg-blue-700">
              <Plus size={12} /> Dodaj
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <Input
            placeholder="Pretraži treninge..."
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
        <div className="bg-blue-50/60 rounded-xl p-3 space-y-3 border border-blue-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sortiraj po</p>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'date_desc', label: 'Najnoviji' },
                { key: 'date_asc', label: 'Najstariji' },
                { key: 'name_asc', label: 'A → Z' },
                { key: 'name_desc', label: 'Z → A' },
                { key: 'exercises_desc', label: 'Najviše vježbi' },
              ] as const).map(opt => (
                <button key={opt.key} type="button" onClick={() => setSort(opt.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    sort === opt.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Minimalno vježbi</p>
            <div className="flex gap-1.5 flex-wrap">
              {[0, 3, 5, 8].map(n => (
                <button key={n} type="button" onClick={() => setMinExercises(n)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    minExercises === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}>
                  {n === 0 ? 'Sve' : `${n}+`}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button type="button" onClick={() => { setSort('date_desc'); setMinExercises(0) }} className="text-xs text-blue-600 flex items-center gap-1 hover:text-blue-800">
              <X size={11} /> Očisti filtere
            </button>
          )}
        </div>
      )}

      {/* Active sort chip */}
      {hasFilters && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Aktivni filteri:</span>
          {sort !== 'date_desc' && (
            <button type="button" onClick={() => setSort('date_desc')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-600 text-white">
              {sort === 'name_asc' ? 'A→Z' : sort === 'name_desc' ? 'Z→A' : sort === 'date_asc' ? 'Najstariji' : 'Najviše vježbi'}
              <X size={10} />
            </button>
          )}
          {minExercises > 0 && (
            <button type="button" onClick={() => setMinExercises(0)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500 text-white">
              {minExercises}+ vježbi <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* Drag hint */}
      {activeType === 'exercise' && (
        <p className="text-xs text-primary/70 text-center py-1 border border-dashed border-primary/30 rounded-lg">
          Ispusti vježbu na trening ↓
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className={`py-10 text-center border-2 border-dashed rounded-xl transition-colors ${
          activeType === 'exercise' ? 'border-primary/40 bg-primary/5' : 'border-gray-100'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
            <Dumbbell size={20} className="text-blue-400" />
          </div>
          <p className="text-gray-400 text-sm">{search ? 'Nema rezultata za pretragu' : 'Nema treninga'}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto">
              <Plus size={11} /> Kreiraj prvi trening
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {sorted.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              activeType={activeType}
              onEdit={() => setEditTemplate(template)}
              onDelete={() => setConfirmDelete(template.id)}
            />
          ))}
        </div>
      )}

      <AddTemplateDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchTemplates} onExerciseCreated={onExerciseCreated} />
      {editTemplate && (
        <EditTemplateDialog
          template={editTemplate}
          open={!!editTemplate}
          onClose={() => setEditTemplate(null)}
          onSuccess={() => { setEditTemplate(null); fetchTemplates() }}
          onExerciseCreated={onExerciseCreated}
        />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('deleteTitle')}
        description={t('deleteConfirm')}
        onConfirm={() => confirmDelete && deleteTemplate(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('delete')}
        destructive
      />
      </div>
    </>
  )

}

