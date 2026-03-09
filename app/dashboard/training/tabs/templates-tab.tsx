'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Dumbbell, Pencil, Trash2 } from 'lucide-react'
import AddTemplateDialog from '../dialogs/add-template-dialog'
import EditTemplateDialog from '../dialogs/edit-template-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'

type Template = {
  id: string
  name: string
  description: string
  exercises: any[]
  created_at: string
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

export default function TemplatesTab() {
  const t = useTranslations('training.templatesTab')
  const tCommon = useTranslations('common')

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
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

  const deleteTemplate = async (id: string) => {
    await supabase.from('workout_templates').delete().eq('id', id)
    setTemplates(templates.filter(t => t.id !== id))
    setConfirmDelete(null)
  }

  const sorted = [...templates].sort((a, b) => {
    if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'name_asc') return a.name.localeCompare(b.name, 'hr')
    if (sort === 'name_desc') return b.name.localeCompare(a.name, 'hr')
    return 0
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('count', { count: templates.length })}</p>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
            className="border rounded-md px-3 py-2 text-sm h-9 bg-white text-gray-700 cursor-pointer"
          >
            <option value="date_desc">{t('sortNewest')}</option>
            <option value="date_asc">{t('sortOldest')}</option>
            <option value="name_asc">{t('sortAZ')}</option>
            <option value="name_desc">{t('sortZA')}</option>
          </select>
          <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
            <Plus size={14} />
            {t('add')}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('noTemplates')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {sorted.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onDoubleClick={() => setEditTemplate(template)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Dumbbell size={16} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-gray-500">{template.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{t('exercises', { count: template.exercises?.length || 0 })}</span>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditTemplate(template) }}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(template.id) }}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
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

      {editTemplate && (
        <EditTemplateDialog
          template={editTemplate}
          open={!!editTemplate}
          onClose={() => setEditTemplate(null)}
          onSuccess={() => {
            setEditTemplate(null)
            fetchTemplates()
          }}
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
  )
}
