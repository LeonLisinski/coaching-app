'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import AddMealPlanDialog from '@/app/dashboard/nutrition/dialogs/add-meal-plan-dialog'
import EditMealPlanDialog from '@/app/dashboard/nutrition/dialogs/edit-meal-plan-dialog'
import { useTranslations, useLocale } from 'next-intl'

type Props = { clientId: string }

type MealPlan = {
  id: string
  name: string
  calories_target: number | null
  protein_target: number | null
  carbs_target: number | null
  fat_target: number | null
  meals: any[]
}

type AssignedPlan = {
  id: string
  active: boolean
  assigned_at: string
  notes: string | null
  plan_type: 'default' | 'training_day' | 'rest_day'
  meal_plan: MealPlan
}

const PLAN_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  default:      { color: '#6b7280', bg: '#f3f4f6' },
  training_day: { color: '#2563eb', bg: '#dbeafe' },
  rest_day:     { color: '#7c3aed', bg: '#ede9fe' },
}

export default function ClientMealPlans({ clientId }: Props) {
  const t = useTranslations('clients.mealPlans')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const PLAN_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    default:      { label: t('planTypeDefault'),     ...PLAN_TYPE_COLORS.default },
    training_day: { label: t('planTypeTrainingDay'), ...PLAN_TYPE_COLORS.training_day },
    rest_day:     { label: t('planTypeRestDay'),     ...PLAN_TYPE_COLORS.rest_day },
  }

  const [assignedPlans, setAssignedPlans] = useState<AssignedPlan[]>([])
  const [availablePlans, setAvailablePlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedPlanType, setSelectedPlanType] = useState<'default' | 'training_day' | 'rest_day'>('default')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState<MealPlan | null>(null)
  const [editingPlanTypeId, setEditingPlanTypeId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: assigned }, { data: available }] = await Promise.all([
      supabase
        .from('client_meal_plans')
        .select(`
          id, active, assigned_at, notes, plan_type,
          meal_plan:meal_plans (id, name, calories_target, protein_target, carbs_target, fat_target, meals)
        `)
        .eq('client_id', clientId)
        .order('assigned_at', { ascending: false }),
      supabase
        .from('meal_plans')
        .select('id, name, calories_target, protein_target, carbs_target, fat_target, meals')
        .eq('trainer_id', user.id)
        .order('name')
    ])

    if (assigned) setAssignedPlans(assigned as any)
    if (available) setAvailablePlans(available)
    setLoading(false)
  }

  const assignPlan = async () => {
    if (!selectedPlanId) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // If assigning training_day or rest_day, deactivate any existing plan of same type
    if (selectedPlanType !== 'default') {
      await supabase
        .from('client_meal_plans')
        .update({ active: false })
        .eq('client_id', clientId)
        .eq('plan_type', selectedPlanType)
        .eq('active', true)
    }

    await supabase.from('client_meal_plans').insert({
      trainer_id: user.id,
      client_id: clientId,
      meal_plan_id: selectedPlanId,
      notes: notes || null,
      active: true,
      plan_type: selectedPlanType,
    })

    setSaving(false)
    setShowAdd(false)
    setSelectedPlanId('')
    setSelectedPlanType('default')
    setNotes('')
    fetchData()
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('client_meal_plans').update({ active: !current }).eq('id', id)
    setAssignedPlans(assignedPlans.map(p => p.id === id ? { ...p, active: !current } : p))
  }

  const changePlanType = async (id: string, newType: 'default' | 'training_day' | 'rest_day') => {
    await supabase.from('client_meal_plans').update({ plan_type: newType }).eq('id', id)
    setAssignedPlans(assignedPlans.map(p => p.id === id ? { ...p, plan_type: newType } : p))
    setEditingPlanTypeId(null)
  }

  const removePlan = async (id: string) => {
    await supabase.from('client_meal_plans').delete().eq('id', id)
    setAssignedPlans(assignedPlans.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  // Group plans for display
  const activePlans = assignedPlans.filter(p => p.active)
  const inactivePlans = assignedPlans.filter(p => !p.active)

  // Check what plan types are already assigned & active
  const hasTrainingDay = activePlans.some(p => p.plan_type === 'training_day')
  const hasRestDay = activePlans.some(p => p.plan_type === 'rest_day')
  const hasDefault = activePlans.some(p => p.plan_type === 'default')

  if (loading) return <p className="text-gray-500 text-sm">{tCommon('loading')}</p>

  return (
    <div className="space-y-4">
      {/* Info banner if both training/rest plans set */}
      {hasTrainingDay && hasRestDay && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          {t('infoBannerBoth')}
        </div>
      )}
      {hasDefault && !hasTrainingDay && !hasRestDay && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {t.rich('infoBannerTip', { strong: (chunks) => <strong>{chunks}</strong> })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('assigned', { count: assignedPlans.length })}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowCreateNew(true); setShowAdd(false) }}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            {t('createNew')}
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowAdd(!showAdd); setShowCreateNew(false) }}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            {t('assignExisting')}
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="py-4 space-y-3">
            <p className="font-medium text-sm">{t('assignPlan')}</p>

            {/* Plan type selector */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 font-medium">{t('planTypeLabel')}</p>
              <div className="flex gap-2">
                {(Object.entries(PLAN_TYPE_LABELS) as [string, any][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlanType(key as any)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      selectedPlanType === key
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
              {selectedPlanType === 'training_day' && (
                <p className="text-xs text-blue-600">{t('trainingDayHint')}</p>
              )}
              {selectedPlanType === 'rest_day' && (
                <p className="text-xs text-purple-600">{t('restDayHint')}</p>
              )}
            </div>

            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">{t('selectPlan')}</option>
              {availablePlans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.calories_target ? ` (${p.calories_target} kcal)` : ''}
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('note')}
              className="w-full border rounded-md px-3 py-2 text-sm min-h-16 resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={assignPlan} disabled={!selectedPlanId || saving}>
                {saving ? tCommon('saving') : t('assign')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {assignedPlans.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('noPlans')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Active plans grouped by type */}
          {activePlans.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('activePlans')}</p>
              {activePlans.map((assigned) => {
                const typeInfo = PLAN_TYPE_LABELS[assigned.plan_type || 'default']
                return (
                  <Card key={assigned.id} className="hover:shadow-sm transition-shadow cursor-pointer" onDoubleClick={() => setEditPlan(assigned.meal_plan)}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{assigned.meal_plan.name}</p>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: typeInfo.color, backgroundColor: typeInfo.bg }}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {assigned.meal_plan.calories_target ? `${assigned.meal_plan.calories_target} kcal · ` : ''}
                          {t('mealsCount', { count: assigned.meal_plan.meals?.length || 0 })} ·
                          {new Date(assigned.assigned_at).toLocaleDateString(locale)}
                        </p>
                        {assigned.notes && (
                          <p className="text-xs text-gray-500 mt-1">{assigned.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {editingPlanTypeId === assigned.id ? (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {(Object.entries(PLAN_TYPE_LABELS) as [string, any][]).map(([key, val]) => (
                              <button
                                key={key}
                                onClick={() => changePlanType(assigned.id, key as any)}
                                className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${
                                  assigned.plan_type === key
                                    ? 'border-blue-500 bg-blue-500 text-white'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {val.label}
                              </button>
                            ))}
                            <button onClick={() => setEditingPlanTypeId(null)} className="text-xs text-gray-400 px-1">✕</button>
                          </div>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingPlanTypeId(assigned.id) }}
                              title={t('changeTypeTitle')}>
                              <span className="text-xs text-gray-400">{t('typeLabel')}</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditPlan(assigned.meal_plan) }}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}>
                              <span className="text-xs text-gray-400">{t('deactivate')}</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(assigned.id) }}>
                              <Trash2 size={14} className="text-red-400" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Inactive plans */}
          {inactivePlans.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('inactivePlans')}</p>
              {inactivePlans.map((assigned) => {
                const typeInfo = PLAN_TYPE_LABELS[assigned.plan_type || 'default']
                return (
                  <Card key={assigned.id} className="opacity-50 hover:opacity-70 transition-opacity cursor-pointer" onDoubleClick={() => setEditPlan(assigned.meal_plan)}>
                    <CardContent className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{assigned.meal_plan.name}</p>
                          <span className="text-xs text-gray-400">{typeInfo.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); toggleActive(assigned.id, assigned.active) }}>
                          {t('activate')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(assigned.id) }}>
                          <Trash2 size={14} className="text-red-400" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      <AddMealPlanDialog
        open={showCreateNew}
        onClose={() => setShowCreateNew(false)}
        onSuccess={async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          const { data: latestPlan } = await supabase
            .from('meal_plans').select('id').eq('trainer_id', user.id)
            .order('created_at', { ascending: false }).limit(1).single()
          if (latestPlan) {
            await supabase.from('client_meal_plans').insert({
              trainer_id: user.id, client_id: clientId,
              meal_plan_id: latestPlan.id, active: true, plan_type: 'default',
            })
          }
          setShowCreateNew(false)
          fetchData()
        }}
      />

      {editPlan && (
        <EditMealPlanDialog plan={editPlan} open={!!editPlan} onClose={() => setEditPlan(null)}
          onSuccess={() => { setEditPlan(null); fetchData() }} />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={tCommon('remove')}
        description={t('removeConfirm')}
        onConfirm={() => confirmDelete && removePlan(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel={tCommon('remove')}
        destructive
      />
    </div>
  )
}
