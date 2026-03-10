'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import AddMealPlanDialog from '../dialogs/add-meal-plan-dialog'
import EditMealPlanDialog from '../dialogs/edit-meal-plan-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type MealPlan = {
  id: string
  name: string
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  meals: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

export default function PlansTab() {
  const t = useTranslations('nutrition.plansTab')
  const tCommon = useTranslations('common')

  const [plans, setPlans] = useState<MealPlan[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('date_desc')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editPlan, setEditPlan] = useState<MealPlan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchPlans() }, [])

  const fetchPlans = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('meal_plans')
      .select('id, name, calories_target, protein_target, carbs_target, fat_target, meals, created_at')
      .eq('trainer_id', user.id)
      .eq('is_template', true)
    if (data) setPlans(data)
    setLoading(false)
  }

  const deletePlan = async (id: string) => {
    await supabase.from('meal_plans').delete().eq('id', id)
    setPlans(plans.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const filtered = plans
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'name_asc') return a.name.localeCompare(b.name)
      if (sort === 'name_desc') return b.name.localeCompare(a.name)
      return 0
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('count', { count: plans.length })}</p>
        <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
          <Plus size={14} />
          {t('add')}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown size={14} className="text-gray-400" />
        <span className="text-sm text-gray-500">{t('sortLabel')}</span>
        {([
          { value: 'date_desc', labelKey: 'sortNewest' },
          { value: 'date_asc', labelKey: 'sortOldest' },
          { value: 'name_asc', labelKey: 'sortAZ' },
          { value: 'name_desc', labelKey: 'sortZA' },
        ] as { value: SortOption; labelKey: string }[]).map(option => (
          <Button
            key={option.value}
            variant={sort === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSort(option.value)}
          >
            {t(option.labelKey as any)}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('noPlans')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((plan) => (
            <Card key={plan.id} className="hover:shadow-sm transition-shadow cursor-pointer" onDoubleClick={() => setEditPlan(plan)}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{plan.name}</p>
                  <p className="text-xs text-gray-400">{t('meals', { count: plan.meals?.length || 0 })}</p>
                </div>
                <div className="flex items-center gap-3">
                  {plan.calories_target && (
                    <span className="text-xs text-gray-500">🎯 {plan.calories_target} kcal</span>
                  )}
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditPlan(plan) }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(plan.id) }}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddMealPlanDialog open={showAdd} onClose={() => setShowAdd(false)} onSuccess={fetchPlans} />
      {editPlan && (
        <EditMealPlanDialog plan={editPlan} open={!!editPlan} onClose={() => setEditPlan(null)}
          onSuccess={() => { setEditPlan(null); fetchPlans() }} />
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
