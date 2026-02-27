'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import AddClientDialog from './add-client-dialog'

type Client = {
  id: string
  full_name: string
  email: string
  goal: string
  active: boolean
  created_at: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select(`
        id,
        goal,
        active,
        created_at,
        profiles!clients_user_id_fkey (
          full_name,
          email
        )
      `)
      .eq('trainer_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      const formatted = data.map((c: any) => ({
        id: c.id,
        full_name: c.profiles?.full_name || 'Bez imena',
        email: c.profiles?.email || '',
        goal: c.goal || '',
        active: c.active,
        created_at: c.created_at,
      }))
      setClients(formatted)
    }
    setLoading(false)
  }

  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Klijenti</h1>
          <p className="text-gray-500">{clients.length} ukupno klijenata</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
          <Plus size={16} />
          Dodaj klijenta
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Pretraži klijente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Učitavanje...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {search ? 'Nema rezultata pretrage' : 'Još nemaš klijenata. Dodaj prvog!'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                      {client.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{client.full_name}</p>
                    <p className="text-sm text-gray-500">{client.email}</p>
                    {client.goal && <p className="text-sm text-gray-400">Cilj: {client.goal}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={client.active ? 'default' : 'secondary'}>
                    {client.active ? 'Aktivan' : 'Neaktivan'}
                  </Badge>
                  <Button variant="outline" size="sm">Otvori</Button>
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
    </div>
  )
}