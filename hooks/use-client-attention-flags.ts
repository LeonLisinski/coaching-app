'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCheckinStatus } from '@/lib/checkin-engagement'

export type ClientAttentionFlags = {
  loading: boolean
  checkinLate: boolean
  /** Nema niti aktivnog treninga niti aktivnog plana prehrane. */
  missingPlan: boolean
  unreadMessages: number
  needsAttention: boolean
}

export function useClientAttentionFlags(clientId: string | undefined): ClientAttentionFlags & { refetch: () => void } {
  const [state, setState] = useState<ClientAttentionFlags>({
    loading: true,
    checkinLate: false,
    missingPlan: false,
    unreadMessages: 0,
    needsAttention: false,
  })

  const load = useCallback(async () => {
    if (!clientId) {
      setState({
        loading: false,
        checkinLate: false,
        missingPlan: false,
        unreadMessages: 0,
        needsAttention: false,
      })
      return
    }

    setState(s => ({ ...s, loading: true }))

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      setState({
        loading: false,
        checkinLate: false,
        missingPlan: false,
        unreadMessages: 0,
        needsAttention: false,
      })
      return
    }

    const [
      { data: cfg },
      { data: lastCi },
      { data: workoutRow },
      { data: mealRow },
      { count: unreadCount },
    ] = await Promise.all([
      supabase.from('checkin_config').select('checkin_day').eq('client_id', clientId).maybeSingle(),
      supabase.from('checkins').select('date').eq('client_id', clientId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('client_workout_plans').select('id').eq('client_id', clientId).eq('active', true).limit(1).maybeSingle(),
      supabase.from('client_meal_plans').select('id').eq('client_id', clientId).eq('active', true).limit(1).maybeSingle(),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('trainer_id', user.id)
        .eq('read', false)
        .neq('sender_id', user.id),
    ])

    const checkinDay = cfg?.checkin_day ?? null
    const lastDate = lastCi?.date ?? null
    const checkinLate = getCheckinStatus(checkinDay, lastDate) === 'late'
    const missingPlan = !workoutRow && !mealRow
    const unreadMessages = unreadCount ?? 0
    const needsAttention = checkinLate || missingPlan || unreadMessages > 0

    setState({
      loading: false,
      checkinLate,
      missingPlan,
      unreadMessages,
      needsAttention,
    })
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, refetch: load }
}
