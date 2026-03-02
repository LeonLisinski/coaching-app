'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, UserX, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AddClientDialog from '@/app/dashboard/clients/add-client-dialog'
import EditClientDialog from '@/app/dashboard/clients/edit-client-dialog'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useTranslations, useLocale } from 'next-intl'

type Client = {
  id: string
  full_name: string
  email: string
  goal: string | null
  weight: number | null
  height: number | null
  date_of_birth: string | null
  start_date: string | null
  active: boolean
}

export default function ClientsPage() {
  const t = useTranslations('clients.page')
  const tCommon = useTranslations('common')
  const tDetail = useTranslations('clients.detail')
  const locale = useLocale()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [showAdd, setShowAdd] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Client | null>(null)
  const router = useRouter()

  const noName = tDetail('noName')

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select(`
        id, goal, weight, height, date_of_birth, start_date, active,
        profiles!clients_user_id_fkey (full_name, email)
      `)
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setClients(data.map((c: any) => ({
        id: c.id,
        full_name: c.profiles?.full_name || noName,
        email: c.profiles?.email || '',
        goal: c.goal,
        weight: c.weight,
        height: c.height,
        date_of_birth: c.date_of_birth,
        start_date: c.start_date,
        active: c.active,
      })))
    }
    setLoading(false)
  }

  const toggleStatus = async (client: Client) => {
    await supabase
      .from('clients')
      .update({ active: !client.active })
      .eq('id', client.id)
    setClients(clients.map(c => c.id === client.id ? { ...c, active: !c.active } : c))
    setConfirmToggle(null)
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'active' ? c.active : !c.active)
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="flex items-center gap-2">
          <Plus size={14} />
          {t('addClient')}
        </Button>
      </div>

      <div className="flex gap-2">
        {[
          { value: 'active', label: t('filterActive') },
          { value: 'inactive', label: t('filterInactive') },
          { value: 'all', label: t('filterAll') },
        ].map(opt => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(opt.value as any)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <p className="text-sm text-gray-500">{t('clientCount', { count: filtered.length })}</p>

      {loading ? (
        <p className="text-gray-500 text-sm">{tCommon('loading')}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {t('noClients')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className={`transition-shadow cursor-pointer hover:shadow-sm ${!client.active ? 'opacity-60' : ''}`}
              onDoubleClick={() => router.push(`/dashboard/clients/${client.id}`)}
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{client.full_name}</p>
                      {!client.active && <Badge variant="secondary" className="text-xs">{tCommon('inactive')}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{client.email}</span>
                      {client.goal && <span>🎯 {client.goal}</span>}
                      {client.start_date && (
                        <span>📅 {t('since')} {new Date(client.start_date).toLocaleDateString(locale)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {client.weight && <span className="text-xs text-gray-400">{client.weight} kg</span>}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setEditClient(client) }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setConfirmToggle(client) }}
                  >
                    {client.active
                      ? <UserX size={14} className="text-red-400" />
                      : <UserCheck size={14} className="text-green-500" />
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddClientDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchClients}
      />

      {editClient && (
        <EditClientDialog
          client={editClient}
          open={!!editClient}
          onClose={() => setEditClient(null)}
          onSuccess={() => {
            setEditClient(null)
            fetchClients()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmToggle !== null}
        title={tCommon(confirmToggle?.active ? 'inactive' : 'active')}
        description={t(confirmToggle?.active ? 'deactivateConfirm' : 'activateConfirm')}
        onConfirm={() => confirmToggle && toggleStatus(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
        confirmLabel={tCommon(confirmToggle?.active ? 'inactive' : 'active')}
        destructive={confirmToggle?.active}
      />
    </div>
  )
}
