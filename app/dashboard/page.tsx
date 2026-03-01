'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Users, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

type ClientSummary = {
  id: string
  full_name: string
  checkin_day: number | null
  last_checkin: string | null
  status: 'submitted' | 'late' | 'neutral'
}

const DAYS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']

function getStatus(checkinDay: number | null, lastCheckin: string | null): 'submitted' | 'late' | 'neutral' {
  if (checkinDay === null) return 'neutral'
  const today = new Date()
  const todayDay = today.getDay()
  const daysAgo = (todayDay - checkinDay + 7) % 7
  const expectedDate = new Date(today)
  expectedDate.setDate(today.getDate() - daysAgo)
  expectedDate.setHours(0, 0, 0, 0)
  if (!lastCheckin) return 'late'
  const lastDate = new Date(lastCheckin)
  lastDate.setHours(0, 0, 0, 0)
  if (lastDate >= expectedDate) return 'submitted'
  return 'late'
}

const STATUS_CONFIG = {
  submitted: { color: 'bg-green-500', text: 'text-green-600', label: 'Checkin poslan' },
  late: { color: 'bg-red-500', text: 'text-red-600', label: 'Kasni' },
  neutral: { color: 'bg-gray-300', text: 'text-gray-400', label: 'Nije konfiguriran' },
}

export default function DashboardPage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [totalActive, setTotalActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: clientsData } = await supabase
      .from('clients')
      .select(`
        id,
        profiles!clients_user_id_fkey (full_name),
        checkin_config (checkin_day)
      `)
      .eq('trainer_id', user.id)
      .eq('active', true)

    if (!clientsData) return
    setTotalActive(clientsData.length)

    const clientIds = clientsData.map(c => c.id)
    const { data: lastCheckins } = await supabase
      .from('checkins')
      .select('client_id, date')
      .in('client_id', clientIds)
      .order('date', { ascending: false })

    const lastCheckinMap: Record<string, string> = {}
    lastCheckins?.forEach(c => {
      if (!lastCheckinMap[c.client_id]) lastCheckinMap[c.client_id] = c.date
    })

    const mapped: ClientSummary[] = clientsData.map((c: any) => {
      const checkinDay = c.checkin_config?.[0]?.checkin_day ?? null
      const lastCheckin = lastCheckinMap[c.id] || null
      return {
        id: c.id,
        full_name: c.profiles?.full_name || 'Bez imena',
        checkin_day: checkinDay,
        last_checkin: lastCheckin,
        status: getStatus(checkinDay, lastCheckin),
      }
    })

    setClients(mapped)
    setLoading(false)
  }

  const submitted = clients.filter(c => c.status === 'submitted')
  const late = clients.filter(c => c.status === 'late')
  const neutral = clients.filter(c => c.status === 'neutral')

  const today = new Date().getDay()
  const tomorrow = (today + 1) % 7

  const todayCheckins = clients.filter(c => c.checkin_day === today)
  const tomorrowCheckins = clients.filter(c => c.checkin_day === tomorrow)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('hr-HR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Summary kartice */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalActive}</p>
              <p className="text-xs text-gray-500">Aktivnih klijenata</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{submitted.length}</p>
              <p className="text-xs text-gray-500">Checkin poslan</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{late.length}</p>
              <p className="text-xs text-gray-500">Kasni s checkinom</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayCheckins.length}</p>
              <p className="text-xs text-gray-500">Checkin danas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Checkin status lista */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-gray-700">Status klijenata</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Učitavanje...</p>
          ) : clients.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-gray-500 text-sm">
                Još nemaš klijenata
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {[...late, ...submitted, ...neutral].map(client => {
                const status = STATUS_CONFIG[client.status]
                return (
                  <Card
                    key={client.id}
                    className="cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => router.push(`/dashboard/checkins/${client.id}`)}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                        <div>
                          <p className="font-medium text-sm">{client.full_name}</p>
                          <p className="text-xs text-gray-400">
                            {client.checkin_day !== null
                              ? `Checkin: ${DAYS[client.checkin_day]}`
                              : 'Dan nije postavljen'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs ${status.text}`}>{status.label}</span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Desna kolona */}
        <div className="space-y-6">
          {/* Upcoming checkini */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-gray-700">Upcoming checkini</h2>
            {todayCheckins.length === 0 && tomorrowCheckins.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-gray-500 text-sm">
                  Nema checkina danas ni sutra
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {todayCheckins.map(client => (
                  <Card
                    key={client.id}
                    className="cursor-pointer hover:shadow-sm transition-shadow border-blue-100"
                    onClick={() => router.push(`/dashboard/checkins/${client.id}`)}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{client.full_name}</p>
                          <p className="text-xs text-blue-500 font-medium">Danas</p>
                        </div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[client.status].color}`} />
                    </CardContent>
                  </Card>
                ))}
                {tomorrowCheckins.map(client => (
                  <Card
                    key={client.id}
                    className="cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => router.push(`/dashboard/checkins/${client.id}`)}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gray-300" />
                        <div>
                          <p className="font-medium text-sm">{client.full_name}</p>
                          <p className="text-xs text-gray-400">Sutra</p>
                        </div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[client.status].color}`} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Kasne s checkinom */}
          {late.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500" />
                Kasne s checkinom ({late.length})
              </h2>
              <div className="space-y-2">
                {late.map(client => (
                  <Card
                    key={client.id}
                    className="cursor-pointer hover:shadow-sm transition-shadow border-red-100"
                    onClick={() => router.push(`/dashboard/checkins/${client.id}`)}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <div>
                          <p className="font-medium text-sm">{client.full_name}</p>
                          <p className="text-xs text-gray-400">
                            {client.checkin_day !== null ? `Checkin: ${DAYS[client.checkin_day]}` : '—'}
                          </p>
                        </div>
                      </div>
                      {client.last_checkin && (
                        <p className="text-xs text-gray-400">
                          Zadnji: {new Date(client.last_checkin).toLocaleDateString('hr-HR')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}