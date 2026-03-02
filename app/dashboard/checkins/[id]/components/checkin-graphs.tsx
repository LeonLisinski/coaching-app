'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Props = { clientId: string }

type Parameter = {
  id: string
  name: string
  type: string
  unit: string | null
}

type Checkin = {
  date: string
  values: Record<string, any>
}

export default function CheckinGraphs({ clientId }: Props) {
  const tCommon = useTranslations('common')
  const tGr = useTranslations('checkins.detail.graphs')
  const locale = useLocale()

  const [parameters, setParameters] = useState<Parameter[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [selectedParam, setSelectedParam] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [clientId])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: params }, { data: checkinsData }] = await Promise.all([
      supabase.from('checkin_parameters').select('*').eq('trainer_id', user.id).order('order_index'),
      supabase.from('checkins').select('date, values').eq('client_id', clientId).order('date')
    ])

    const numericParams = (params || []).filter(p => p.type === 'number')
    setParameters(numericParams)
    if (numericParams.length > 0) setSelectedParam(numericParams[0].id)
    if (checkinsData) setCheckins(checkinsData)
    setLoading(false)
  }

  const selectedParamData = parameters.find(p => p.id === selectedParam)

  const chartData = checkins
    .filter(c => c.values[selectedParam] !== undefined && c.values[selectedParam] !== null && c.values[selectedParam] !== '')
    .map(c => ({
      date: new Date(c.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
      value: parseFloat(c.values[selectedParam]),
    }))

  if (loading) return <p className="text-gray-500 text-sm">{tCommon('loading')}</p>

  if (parameters.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500 text-sm">
          {tGr('noNumericParams')}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-500">{tGr('parameterLabel')}</p>
        <select
          value={selectedParam}
          onChange={(e) => setSelectedParam(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          {parameters.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</option>
          ))}
        </select>
      </div>

      {chartData.length < 2 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm">
            {tGr('notEnoughData')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-medium mb-4">
              {selectedParamData?.name}
              {selectedParamData?.unit && ` (${selectedParamData.unit})`}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(value: number | undefined) => [`${value}${selectedParamData?.unit ? ` ${selectedParamData.unit}` : ''}`, selectedParamData?.name]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { labelKey: 'minimum', value: Math.min(...chartData.map(d => d.value)) },
            { labelKey: 'average', value: (chartData.reduce((a, b) => a + b.value, 0) / chartData.length) },
            { labelKey: 'maximum', value: Math.max(...chartData.map(d => d.value)) },
          ].map(stat => (
            <Card key={stat.labelKey}>
              <CardContent className="py-3 text-center">
                <p className="text-xs text-gray-500">{tGr(stat.labelKey as any)}</p>
                <p className="font-semibold text-sm">
                  {stat.value.toFixed(1)}{selectedParamData?.unit ? ` ${selectedParamData.unit}` : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
