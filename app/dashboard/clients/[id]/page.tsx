'use client'
export const dynamic = 'force-dynamic'
import MobileClientDetail from '@/app/dashboard/clients/[id]/mobile-client-detail'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePersistedTab } from '@/app/contexts/tab-state'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Pencil, CreditCard, Trash2, Dumbbell, UtensilsCrossed, ActivitySquare, Package, History, ClipboardList, BarChart2, Settings2, LayoutDashboard, GitCommitHorizontal } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import EditClientDialog from '@/app/dashboard/clients/edit-client-dialog'

function dobDisplayToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
function isoToDisplay(iso: string | null): string {
  if (!iso || !iso.match(/^\d{4}-\d{2}-\d{2}$/)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function Stat({ label, value, sub, valueClass }: {
  label: string; value: string; sub?: string; valueClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium leading-tight ${valueClass || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
import CheckinOverview from '@/app/dashboard/checkins/[id]/components/checkin-overview'
import CheckinHistory from '@/app/dashboard/checkins/[id]/components/checkin-history'
import CheckinGraphs from '@/app/dashboard/checkins/[id]/components/checkin-graphs'
import CheckinConfig from '@/app/dashboard/checkins/[id]/components/checkin-config'
import ClientWorkoutPlans from '@/app/dashboard/clients/[id]/components/client-workout-plans'
import ClientMealPlans from '@/app/dashboard/clients/[id]/components/client-meal-plans'
import ClientPackages from '@/app/dashboard/clients/[id]/components/client-packages'
import ClientHistory from '@/app/dashboard/clients/[id]/components/client-history'
import ClientOverview from '@/app/dashboard/clients/[id]/components/client-overview'
import ClientCalculator from '@/app/dashboard/clients/[id]/components/client-calculator'
import ClientTimeline from '@/app/dashboard/clients/[id]/components/client-timeline'
import { useTranslations } from 'next-intl'

type ActivityLevel = '' | 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary:   'Sjedilački',
  light:       'Lagano aktivan',
  moderate:    'Umjereno aktivan',
  active:      'Jako aktivan',
  very_active: 'Izuzetno aktivan',
}

const ACTIVITY_OPTIONS: { value: Exclude<ActivityLevel, ''>; label: string; desc: string }[] = [
  { value: 'sedentary',   label: 'Sjedilački',       desc: 'Malo ili bez vježbanja' },
  { value: 'light',       label: 'Lagano aktivan',   desc: '1–3× tjedno' },
  { value: 'moderate',    label: 'Umjereno aktivan', desc: '3–5× tjedno' },
  { value: 'active',      label: 'Jako aktivan',     desc: '6–7× tjedno' },
  { value: 'very_active', label: 'Izuzetno aktivan', desc: 'Fizički posao + trening' },
]

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
  gender: string | null
  notes: string | null
  activity_level: string | null
  step_goal: number | null
}

type ActivePackage = {
  id: string
  name: string
  color: string
  end_date: string
  status: string
}

type EditForm = {
  full_name: string
  goal: string
  weight: string
  height: string
  dob_display: string
  date_of_birth: string
  start_date: string
  start_display: string
  gender: '' | 'M' | 'F'
  activity_level: ActivityLevel
  step_goal: string
  notes: string
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('hr-HR')
}

function ClientDetailPageContent() {
  const t = useTranslations('clients.detail')
  const tCommon = useTranslations('common')

  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab')
  // Per-client persistence; URL param overrides storage (for quick-action deep links)
  const [activeTab, setActiveTab] = usePersistedTab(`client_tab_${id as string}`, 'pregled')
  // URL ?tab=xxx takes priority over stored value (e.g. quick-action links)
  useEffect(() => { if (urlTab) setActiveTab(urlTab) }, [urlTab])
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [activePackage, setActivePackage] = useState<ActivePackage | null>(null)
  const [showCheckinConfig, setShowCheckinConfig] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const noName = t('noName')

  useEffect(() => { fetchClient() }, [id])

  const fetchClient = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('clients')
      .select(`id, goal, weight, height, date_of_birth, start_date, active, gender, notes, activity_level, step_goal,
        profiles!clients_user_id_fkey (full_name, email)`)
      .eq('id', id)
      .eq('trainer_id', user.id)
      .single()

    if (!data) {
      router.push('/dashboard/clients')
      return
    }

    const c: Client = {
      id: data.id,
      full_name: (data.profiles as any)?.full_name || noName,
      email: (data.profiles as any)?.email || '',
      goal: data.goal, weight: data.weight, height: data.height,
      date_of_birth: data.date_of_birth, start_date: data.start_date, active: data.active,
      gender: data.gender, notes: data.notes,
      activity_level: data.activity_level, step_goal: data.step_goal,
    }
    setClient(c)

    // Fetch active package
    const { data: pkgData } = await supabase
      .from('client_packages')
      .select('id, start_date, end_date, status, packages(name, color)')
      .eq('client_id', id)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pkgData) {
      setActivePackage({
        id: pkgData.id,
        name: (pkgData.packages as any)?.name || 'Paket',
        color: (pkgData.packages as any)?.color || '#6366f1',
        end_date: pkgData.end_date,
        status: pkgData.status,
      })
    }

    setLoading(false)
  }

  const deleteClient = async () => {
    if (!client) return
    await supabase.from('checkins').delete().eq('client_id', client.id)
    await supabase.from('payments').delete().eq('client_id', client.id)
    await supabase.from('client_packages').delete().eq('client_id', client.id)
    await supabase.from('client_meal_plans').delete().eq('client_id', client.id)
    await supabase.from('client_workout_plans').delete().eq('client_id', client.id)
    await supabase.from('checkin_config').delete().eq('client_id', client.id)
    await supabase.from('messages').delete().eq('receiver_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)
    router.push('/dashboard/clients')
  }

  if (loading) return <p className="text-gray-500 text-sm p-8">{tCommon('loading')}</p>
  if (!client) return <p className="text-gray-500 text-sm p-8">Klijent nije pronađen</p>

  const initials = client.full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const headerGradient = client.gender === 'F'
    ? 'from-rose-800 to-rose-950'
    : client.gender === 'M'
      ? 'from-blue-800 to-blue-950'
      : 'from-violet-800 to-purple-950'
  const headerBorder = client.gender === 'F' ? 'border-rose-900' : client.gender === 'M' ? 'border-blue-900' : 'border-violet-900'

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className={`rounded-2xl overflow-hidden border ${headerBorder} shadow-sm`}>
        <div className={`bg-gradient-to-r ${headerGradient} px-6 py-5 flex items-center gap-4`}>
          <button
            onClick={() => router.push('/dashboard/clients')}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft size={15} className="text-white" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-bold text-lg leading-tight">{client.full_name}</h1>
              {client.gender && <span className="text-white/60">{client.gender === 'M' ? '♂' : '♀'}</span>}
              {!client.active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/80 font-medium">Neaktivan</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-white/60 text-xs">{client.email}</p>
              {activePackage && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white font-medium flex items-center gap-1">
                  <CreditCard size={10} />
                  {activePackage.name}
                  {activePackage.end_date && (
                    <span className="opacity-70"> · do {formatDate(activePackage.end_date)}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowEditDialog(true)}
              className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              title="Uredi podatke"
            >
              <Pencil size={14} className="text-white" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-8 h-8 rounded-xl bg-black/10 hover:bg-red-500/40 flex items-center justify-center transition-colors"
              title="Obriši klijenta"
            >
              <Trash2 size={14} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="relative">
              <div className="absolute top-0 right-0">
                <ClientCalculator
                  clientId={client.id}
                  client={client}
                  onSaved={fetchClient}
                />
              </div>

              {/* Main stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-4 pr-8">
                {client.goal && (
                  <Stat label={t('stats.goal')} value={client.goal} />
                )}
                {client.gender && (
                  <Stat label="Spol" value={client.gender === 'M' ? 'Muško' : 'Žensko'} />
                )}
                <Stat
                  label={t('stats.status')}
                  value={client.active ? tCommon('active') : tCommon('inactive')}
                  valueClass={client.active ? 'text-emerald-600' : 'text-red-500'}
                />
                {(client.weight || client.height) && (
                  <>
                    {client.weight && <Stat label={t('stats.weight')} value={`${client.weight} kg`} />}
                    {client.height && <Stat label={t('stats.height')} value={`${client.height} cm`} />}
                  </>
                )}
                {client.date_of_birth && (
                  <Stat
                    label={t('stats.dateOfBirth')}
                    value={formatDate(client.date_of_birth)!}
                    sub={`${calcAge(client.date_of_birth)} god.`}
                  />
                )}
                {client.start_date && (
                  <Stat label={t('stats.startDate')} value={formatDate(client.start_date)!} />
                )}
                {client.activity_level && (
                  <Stat label="Razina aktivnosti" value={ACTIVITY_LABELS[client.activity_level] || client.activity_level} />
                )}
                {client.step_goal && (
                  <Stat label="Dnevni cilj koraka" value={`${client.step_goal.toLocaleString('hr-HR')} koraka`} />
                )}
              </div>

              {/* Notes */}
              {client.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Bilješke</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Edit client dialog */}
      {showEditDialog && (
        <EditClientDialog
          client={client}
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSuccess={() => { fetchClient(); setShowEditDialog(false) }}
        />
      )}

      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="flex items-center gap-2">
            <TabsList className="flex-nowrap overflow-x-auto sm:flex-wrap h-auto gap-1 bg-gray-100/80 scrollbar-hide">
              <TabsTrigger value="pregled" className="flex items-center gap-1.5">
                <LayoutDashboard size={13} />Pregled
              </TabsTrigger>
              <TabsTrigger value="pracenje" className="flex items-center gap-1.5">
                <ActivitySquare size={13} />{t('tabs.pracenje')}
              </TabsTrigger>
              <TabsTrigger value="checkin" className="flex items-center gap-1.5">
                <ClipboardList size={13} />{t('tabs.weeklyCheckin')}
              </TabsTrigger>
              <TabsTrigger value="slike" className="flex items-center gap-1.5">
                <History size={13} />{t('tabs.slike')}
              </TabsTrigger>
              <TabsTrigger value="graphs" className="flex items-center gap-1.5">
                <BarChart2 size={13} />{t('tabs.graphs')}
              </TabsTrigger>
              <TabsTrigger value="treninzi" className="flex items-center gap-1.5">
                <Dumbbell size={13} />{t('tabs.training')}
              </TabsTrigger>
              <TabsTrigger value="prehrana" className="flex items-center gap-1.5">
                <UtensilsCrossed size={13} />{t('tabs.nutrition')}
              </TabsTrigger>
              <TabsTrigger value="paketi" className="flex items-center gap-1.5">
                <Package size={13} />{t('tabs.packages')}
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-1.5">
                <GitCommitHorizontal size={13} />Timeline
              </TabsTrigger>
            </TabsList>
            <button
              onClick={() => setShowCheckinConfig(true)}
              title={t('tabs.checkinSettings')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            >
              <Settings2 size={15} />
            </button>
          </div>

          <TabsContent value="pregled" className="mt-6">
            <ClientOverview clientId={id as string} />
          </TabsContent>
          <TabsContent value="pracenje" className="mt-6">
            <ClientHistory clientId={id as string} />
          </TabsContent>
          <TabsContent value="checkin" className="mt-6">
            <CheckinOverview clientId={id as string} />
          </TabsContent>
          <TabsContent value="slike" className="mt-6">
            <CheckinHistory clientId={id as string} />
          </TabsContent>
          <TabsContent value="graphs" className="mt-6">
            <CheckinGraphs clientId={id as string} />
          </TabsContent>
          <TabsContent value="treninzi" className="mt-6">
            <ClientWorkoutPlans clientId={id as string} />
          </TabsContent>
          <TabsContent value="prehrana" className="mt-6">
            <ClientMealPlans clientId={id as string} />
          </TabsContent>
          <TabsContent value="paketi" className="mt-6">
            <ClientPackages clientId={id as string} />
          </TabsContent>
          <TabsContent value="timeline" className="mt-6">
            <ClientTimeline clientId={id as string} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Check-in settings dialog */}
      <Dialog open={showCheckinConfig} onOpenChange={setShowCheckinConfig}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('tabs.checkinSettings')}</DialogTitle>
          </DialogHeader>
          <CheckinConfig clientId={id as string} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Brisanje klijenta: ${client.full_name}`}
        description={
          <div className="space-y-3">
            <p>Brisanjem ovog klijenta trajno će se ukloniti <span className="font-semibold text-gray-800">svi podaci vezani za njega</span>:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
              <li>Svi check-inovi i fotografije napretka</li>
              <li>Planovi prehrane i treninga</li>
              <li>Paketi i evidencija plaćanja</li>
              <li>Sve poruke u chatu</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2">
              <span className="text-amber-500 text-base leading-none mt-0.5">💡</span>
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Preporuka:</span> Umjesto brisanja, razmotrite{' '}
                <button
                  type="button"
                  className="underline font-semibold hover:text-amber-900"
                  onClick={async () => {
                    setConfirmDelete(false)
                    await supabase.from('clients').update({ active: false }).eq('id', client.id)
                    fetchClient()
                  }}
                >
                  deaktivaciju klijenta
                </button>
                . Na taj način zadržavate sve podatke i povijest, ali klijent više nije aktivan.
              </p>
            </div>
            <p className="font-bold text-red-600">Ova radnja je nepovratna i ne može se poništiti.</p>
            <p className="text-gray-700">Želite li nastaviti s brisanjem klijenta?</p>
          </div>
        }
        onConfirm={deleteClient}
        onCancel={() => setConfirmDelete(false)}
        confirmLabel="Da, obriši"
        cancelLabel="Ne, odustani"
        destructive
      />
    </div>
  )
}

export default function ClientDetailPage() {
  return (
    <>
      <div className="hidden lg:block">
        <Suspense fallback={null}>
          <ClientDetailPageContent />
        </Suspense>
      </div>
      <div className="lg:hidden"><MobileClientDetail /></div>
    </>
  )
}
