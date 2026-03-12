'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2, CalendarDays, PlusCircle, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import AddPlanDialog from '../dialogs/add-plan-dialog'
import EditPlanDialog from '../dialogs/edit-plan-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useDroppable } from '@dnd-kit/core'

type WorkoutPlan = {
  id: string
  name: string
  description: string
  days: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'days_desc'

// ─── Plan card — droppable (accepts templates) ─────────────────────────────────
function PlanCard({
  plan,
  activeType,
  onEdit,
  onDelete,
}: {
  plan: WorkoutPlan
  activeType?: 'exercise' | 'template' | null
  onEdit: () => void
  onDelete: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `plan-drop::${plan.id}`,
    data: { type: 'plan-drop', planId: plan.id },
  })

  const showDropHint = activeType === 'template'
  const isActive = isOver && activeType === 'template'

  return (
    <div
      ref={setNodeRef}
      className={`relative border rounded-xl p-3 transition-all duration-150 bg-white cursor-default select-none ${
        isActive
          ? 'border-indigo-500 shadow-md ring-2 ring-indigo-400/25 bg-indigo-50/40'
          : showDropHint
          ? 'border-dashed border-indigo-300/50'
          : 'border-gray-100 hover:shadow-sm hover:border-gray-200'
      }`}
      onDoubleClick={() => onEdit()}
    >
      {isActive && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-10">
          <div className="bg-indigo-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <PlusCircle size={12} /> Dodaj kao novi dan
          </div>
        </div>
      )}

      <div className={`flex items-start gap-2 ${isActive ? 'opacity-30' : ''}`}>
        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
          <CalendarDays size={12} className="text-indigo-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate text-gray-800">{plan.name}</p>
          {plan.description && (
            <p className="text-xs text-gray-400 truncate">{plan.description}</p>
          )}
          <p className="text-[10px] text-gray-300 mt-0.5">dvoklik za uređivanje</p>
          {plan.days?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {plan.days.slice(0, 4).map((day: any, i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 truncate max-w-[80px]">
                  {day.name || `Dan ${i + 1}`}
                </span>
              ))}
              {plan.days.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100">
                  +{plan.days.length - 4} dana
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onDoubleClick={e => e.stopPropagation()}>
          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium border border-indigo-100">
            {plan.days?.length ?? 0}d
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
    </div>
  )
}

// ─── Main tab ──────────────────────────────────────────────────────────────────
export default function PlansTab({ activeType }: { activeType?: 'exercise' | 'template' | null }) {
  const t = useTranslations('training.plansTab')
  const tCommon = useTranslations('common')

  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('date_desc')
  const [minDays, setMinDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editPlan, setEditPlan] = useState<WorkoutPlan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { fetchPlans() }, [])

  const fetchPlans = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('trainer_id', user.id)
      .eq('is_template', true)
    if (data) setPlans(data)
    setLoading(false)
  }

  const deletePlan = async (id: string) => {
    await supabase.from('workout_plans').delete().eq('id', id)
    setPlans(plans.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const filtered = plans
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (p.days?.length ?? 0) >= minDays
    )
    .sort((a, b) => {
      if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'hr')
      if (sort === 'name_desc') return b.name.localeCompare(a.name, 'hr')
      if (sort === 'days_desc') return (b.days?.length ?? 0) - (a.days?.length ?? 0)
      return 0
    })

  const hasFilters = sort !== 'date_desc' || minDays > 0

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-xs">{filtered.length} / {plans.length} planova</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 h-7 text-xs px-2.5 ${hasFilters ? 'border-indigo-300 text-indigo-600 bg-indigo-50' : ''}`}
          >
            <SlidersHorizontal size={12} />
            Filtriraj
            {hasFilters && <span className="bg-indigo-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
            <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm" className="h-7 text-xs flex items-center gap-1 px-2.5 bg-indigo-600 hover:bg-indigo-700">
            <Plus size={12} /> Dodaj
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <Input
          placeholder="Pretraži planove..."
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

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-indigo-50/60 rounded-xl p-3 space-y-3 border border-indigo-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sortiraj po</p>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'date_desc', label: 'Najnoviji' },
                { key: 'date_asc', label: 'Najstariji' },
                { key: 'name_asc', label: 'A → Z' },
                { key: 'name_desc', label: 'Z → A' },
                { key: 'days_desc', label: 'Najviše dana' },
              ] as const).map(opt => (
                <button key={opt.key} type="button" onClick={() => setSort(opt.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    sort === opt.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Minimalno dana</p>
            <div className="flex gap-1.5 flex-wrap">
              {[0, 2, 4, 6].map(n => (
                <button key={n} type="button" onClick={() => setMinDays(n)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                    minDays === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}>
                  {n === 0 ? 'Sve' : `${n}+`}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button type="button" onClick={() => { setSort('date_desc'); setMinDays(0) }} className="text-xs text-indigo-600 flex items-center gap-1 hover:text-indigo-800">
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
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-600 text-white">
              {sort === 'name_asc' ? 'A→Z' : sort === 'name_desc' ? 'Z→A' : sort === 'date_asc' ? 'Najstariji' : 'Najviše dana'}
              <X size={10} />
            </button>
          )}
          {minDays > 0 && (
            <button type="button" onClick={() => setMinDays(0)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-500 text-white">
              {minDays}+ dana <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* Drag hint */}
      {activeType === 'template' && (
        <p className="text-xs text-indigo-600/70 text-center py-1 border border-dashed border-indigo-300/40 rounded-lg">
          Ispusti trening na plan da dodaš novi dan ↓
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`py-10 text-center border-2 border-dashed rounded-xl transition-colors ${
          activeType === 'template' ? 'border-indigo-300/50 bg-indigo-50/30' : 'border-gray-100'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-2">
            <CalendarDays size={20} className="text-indigo-400" />
          </div>
          <p className="text-gray-400 text-sm">{search ? 'Nema rezultata za pretragu' : t('noPlans')}</p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mx-auto">
              <Plus size={11} /> Kreiraj prvi plan
            </button>
          )}
          {activeType === 'template' && (
            <p className="text-xs text-indigo-500/60 mt-1">Ili ispusti trening ovdje</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              activeType={activeType}
              onEdit={() => setEditPlan(plan)}
              onDelete={() => setConfirmDelete(plan.id)}
            />
          ))}
        </div>
      )}

      <AddPlanDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchPlans} />
      {editPlan && (
        <EditPlanDialog
          plan={editPlan}
          open={!!editPlan}
          onClose={() => setEditPlan(null)}
          onSuccess={() => { setEditPlan(null); fetchPlans() }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('deleteTitle')}
        description={t('deleteConfirm')}
        onConfirm={() => confirmDelete && deletePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('delete')}
        destructive
      />
    </div>
  )
}

