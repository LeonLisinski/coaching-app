import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/resend-server'
import {
  daysFromTodayToEndDate,
  getIsoWeekFromYmd,
  getReminderCalendar,
} from '@/lib/reminder-calendar'
import {
  buildPackageExpiryEmail,
  buildPendingPaymentsEmail,
  buildTrialEndingEmail,
} from '@/lib/email-templates'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function pickCheckinDay(raw: unknown): number | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return (raw[0] as { checkin_day?: number })?.checkin_day ?? null
  return (raw as { checkin_day?: number }).checkin_day ?? null
}

async function tryInsertDedupe(supabase: any, kind: string, dedupeKey: string): Promise<boolean> {
  const { error } = await supabase.from('reminder_sent').insert({ kind, dedupe_key: dedupeKey })
  if (error?.code === '23505') return false
  if (error) throw error
  return true
}

/**
 * Daily reminders (Vercel Cron or manual with CRON_SECRET):
 * - Clients: email on check-in day if not yet submitted today
 * - Trainers: expiring packages (7 / 3 / 1 / 0 days)
 * - Trainers: weekly digest of pending payments
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  // U produkciji CRON_SECRET je obavezan — `x-vercel-cron` header je spoofable.
  if (!secret) {
    if (process.env.NODE_ENV !== 'development') {
      console.error('[cron/reminders] CRON_SECRET not configured in production')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
    // Dev bez secreta: dopušteno radi lakše lokalne provjere.
  } else if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://app.unitlift.com'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const tz = process.env.REMINDER_TIMEZONE || 'Europe/Zagreb'
  const { todayStr, todayDow } = getReminderCalendar(new Date(), tz)

  let checkinSent = 0
  let pkgSent = 0
  let paySent = 0
  let trialReminderSent = 0
  let checkinDueCount = 0
  const errors: string[] = []

  // ── Check-in reminders (clients) ───────────────────────────────────────────
  // NOTE: Client check-in push + email is fully handled by the `client-reminders`
  // Supabase Edge Function (pg_cron at 08:00 UTC), which respects client_notification_prefs
  // for both day-before and day-of reminders. This block is intentionally removed to
  // prevent duplicate emails when both jobs run on the same day.
  checkinDueCount = 0

  // Samo treneri koji imaju aktivni paket ili pending plaćanje — ne cijela tablica profiles
  let trainerMap = new Map<string, { id: string; full_name: string | null; email: string | null }>()
  try {
    const tidSet = new Set<string>()
    const { data: apt } = await supabase.from('client_packages').select('trainer_id').eq('status', 'active')
    apt?.forEach((r: { trainer_id: string }) => tidSet.add(r.trainer_id))
    const { data: ppt } = await supabase.from('payments').select('trainer_id').eq('status', 'pending')
    ppt?.forEach((r: { trainer_id: string }) => tidSet.add(r.trainer_id))
    const tids = [...tidSet]
    if (tids.length) {
      const { data: trainerRows } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', tids)
      trainerMap = new Map((trainerRows || []).map(t => [t.id, t]))
    }
  } catch (e: any) {
    errors.push(`trainer map: ${e?.message || e}`)
  }

  // ── Package expiry (trainers) ───────────────────────────────────────────────
  try {
    const { data: cps, error } = await supabase
      .from('client_packages')
      .select(
        `
        id,
        client_id,
        trainer_id,
        end_date,
        status,
        packages ( name ),
        clients!inner ( active, profiles!clients_user_id_fkey ( full_name ) )
      `,
      )
      .eq('status', 'active')
      .eq('clients.active', true)

    if (error) throw error

    // Preload all 'package' prefs for trainers that have relevant packages — avoids N+1 queries in the loop
    const relevantTrainerIds = [...new Set((cps ?? []).map((cp: any) => cp.trainer_id as string))]
    const pkgEmailPrefsMap = new Map<string, boolean>()
    const pkgPushPrefsMap  = new Map<string, boolean>()
    if (relevantTrainerIds.length) {
      const { data: prefsRows } = await supabase
        .from('trainer_notification_prefs')
        .select('trainer_id, push_enabled, email_enabled')
        .in('trainer_id', relevantTrainerIds)
        .eq('type', 'package')
      ;(prefsRows ?? []).forEach((p: any) => {
        pkgEmailPrefsMap.set(p.trainer_id, p.email_enabled)
        pkgPushPrefsMap.set(p.trainer_id, p.push_enabled)
      })
    }

    // Preload push subscriptions for trainers with push enabled — avoids per-row queries
    const pushEnabledTrainerIds = relevantTrainerIds.filter(tid =>
      pkgPushPrefsMap.has(tid) ? pkgPushPrefsMap.get(tid) : true
    )
    const pushSubsMap = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>()
    if (pushEnabledTrainerIds.length) {
      const { data: subRows } = await supabase
        .from('push_subscriptions')
        .select('trainer_id, endpoint, p256dh, auth')
        .in('trainer_id', pushEnabledTrainerIds)
      ;(subRows ?? []).forEach((s: any) => {
        if (!pushSubsMap.has(s.trainer_id)) pushSubsMap.set(s.trainer_id, [])
        pushSubsMap.get(s.trainer_id)!.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
      })
    }

    for (const cp of cps || []) {
      const endDateStr = (cp as any).end_date as string
      const daysLeft = daysFromTodayToEndDate(endDateStr, todayStr)
      const milestones = [7, 3, 1, 0]
      if (!milestones.includes(daysLeft)) continue

      const trainer = trainerMap.get((cp as any).trainer_id as string)
      if (!trainer?.email) continue

      const clientName = ((cp as any).clients as any)?.profiles?.full_name || 'Klijent'
      const pkgName = ((cp as any).packages as any)?.name || 'Paket'

      const dedupeKey = `pkg-${(cp as any).id}-d${daysLeft}-${todayStr}`
      const inserted = await tryInsertDedupe(supabase, 'package_expiry', dedupeKey)
      if (!inserted) continue

      // Insert in-app notification (1 day and 0 days only)
      if (daysLeft <= 1) {
        const notifSourceId = `pkg-notif-${(cp as any).id}-d${daysLeft}-${todayStr}`
        await supabase
          .from('trainer_notifications')
          .upsert({
            trainer_id: (cp as any).trainer_id,
            type: 'package',
            title: clientName,
            body: daysLeft === 0
              ? `Paket "${pkgName}" istječe danas`
              : `Paket "${pkgName}" istječe sutra`,
            href: `${url}/dashboard/clients/${(cp as any).client_id}?tab=paketi`,
            source_id: notifSourceId,
          }, { onConflict: 'trainer_id,source_id', ignoreDuplicates: true })
      }

      // Web push notification — respect push_enabled pref (default: ON)
      const pushEnabled = pkgPushPrefsMap.has((cp as any).trainer_id)
        ? pkgPushPrefsMap.get((cp as any).trainer_id)!
        : true
      if (pushEnabled) {
        const trainerSubs = pushSubsMap.get((cp as any).trainer_id) ?? []
        if (trainerSubs.length > 0) {
          const pushPayload = JSON.stringify({
            title: `📦 ${clientName}`,
            body: daysLeft === 0
              ? `Paket "${pkgName}" istječe danas`
              : `Paket "${pkgName}" istječe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}`,
            url: `/dashboard/clients/${(cp as any).client_id}?tab=paketi`,
            tag: `package-${(cp as any).id}`,
            icon: '/apple-touch-icon.png',
          })
          const pushSecret = process.env.PUSH_SECRET
          if (pushSecret) {
            await Promise.all(
              trainerSubs.map(sub =>
                fetch(`${url}/api/push/send-internal`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-push-secret': pushSecret },
                  body: JSON.stringify({ sub, payload: pushPayload }),
                }).catch(() => {}),
              ),
            )
          }
        }
      }

      // Use preloaded pref (default: email enabled for packages if no pref row exists)
      const emailEnabled = pkgEmailPrefsMap.has((cp as any).trainer_id)
        ? pkgEmailPrefsMap.get((cp as any).trainer_id)!
        : true
      if (!emailEnabled) { continue }

      const html = buildPackageExpiryEmail({
        trainerFirstName: trainer.full_name?.split(' ')[0] || 'Trener',
        clientName,
        packageName: pkgName,
        daysLeft,
        endDate: endDateStr,
        clientPackageUrl: `${url}/dashboard/clients/${(cp as any).client_id}?tab=paketi`,
      })

      const r = await sendResendEmail({
        to: trainer.email,
        subject:
          daysLeft === 0
            ? `UnitLift: paket istječe danas — ${clientName.split(' ')[0]}`
            : `UnitLift: paket istječe za ${daysLeft} d — ${clientName.split(' ')[0]}`,
        html,
      })
      if (r.ok) pkgSent++
      else errors.push(`pkg ${(cp as any).id}: ${r.errorKey}`)
    }
  } catch (e: any) {
    errors.push(`package block: ${e?.message || e}`)
  }

  // ── Pending payments — weekly digest per trainer ────────────────────────────
  try {
    const { data: pending, error } = await supabase
      .from('payments')
      .select(
        `
        id,
        amount,
        trainer_id,
        client_id,
        status,
        clients!inner ( active, profiles!clients_user_id_fkey ( full_name ) )
      `,
      )
      .eq('status', 'pending')

    if (error) throw error

    const weekKey = `${todayStr.slice(0, 4)}-W${getIsoWeekFromYmd(todayStr)}`
    const byTrainer = new Map<string, { email: string; name: string; items: { client: string; amount: number }[] }>()

    for (const p of pending || []) {
      const c = p.clients as any
      if (!c?.active) continue
      const trainer = trainerMap.get(p.trainer_id as string)
      if (!trainer?.email) continue
      const clientName = c?.profiles?.full_name || 'Klijent'
      if (!byTrainer.has(p.trainer_id as string)) {
        byTrainer.set(p.trainer_id as string, { email: trainer.email, name: trainer.full_name || '', items: [] })
      }
      byTrainer.get(p.trainer_id as string)!.items.push({ client: clientName, amount: p.amount || 0 })
    }

    for (const [tid, bundle] of byTrainer) {
      const dedupeKey = `pay-pending-${tid}-${weekKey}`
      const inserted = await tryInsertDedupe(supabase, 'payment_pending', dedupeKey)
      if (!inserted) continue

      const html = buildPendingPaymentsEmail({
        trainerFirstName: bundle.name.split(' ')[0] || 'Trener',
        items: bundle.items.map(i => ({ clientName: i.client, amount: i.amount })),
        financeUrl: `${url}/dashboard/financije`,
      })

      const r = await sendResendEmail({
        to: bundle.email,
        subject: `UnitLift: otvorena plaćanja (${bundle.items.length})`,
        html,
      })
      if (r.ok) paySent++
      else errors.push(`pay ${tid}: ${r.errorKey}`)
    }
  } catch (e: any) {
    errors.push(`payment block: ${e?.message || e}`)
  }

  // ── Trial ending reminders (7 and 2 days before charge) ───────────────────
  try {
    const now7d = new Date(); now7d.setDate(now7d.getDate() + 7)
    const now2d = new Date(); now2d.setDate(now2d.getDate() + 2)

    // Fetch trialing subs whose trial ends in the 7d or 2d window (±12 hours)
    const windowStart7 = new Date(now7d); windowStart7.setHours(windowStart7.getHours() - 12)
    const windowEnd7   = new Date(now7d); windowEnd7.setHours(windowEnd7.getHours() + 12)
    const windowStart2 = new Date(now2d); windowStart2.setHours(windowStart2.getHours() - 12)
    const windowEnd2   = new Date(now2d); windowEnd2.setHours(windowEnd2.getHours() + 12)

    const { data: trialSubs } = await supabase
      .from('subscriptions')
      .select('trainer_id, trial_end, plan')
      .eq('status', 'trialing')
      .not('is_ambassador', 'eq', true)
      .not('trial_end', 'is', null)

    // Preload profiles for all trialing trainers — avoids N+1 individual fetches in the loop
    const trialTrainerIds = (trialSubs ?? []).map((ts: any) => ts.trainer_id as string)
    const trialProfileMap = new Map<string, { full_name: string | null; email: string | null }>()
    if (trialTrainerIds.length) {
      const { data: trialProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', trialTrainerIds)
      ;(trialProfiles ?? []).forEach((p: any) => trialProfileMap.set(p.id, p))
    }

    for (const ts of trialSubs ?? []) {
      const trialEndDate = new Date(ts.trial_end)
      const in7d = trialEndDate >= windowStart7 && trialEndDate <= windowEnd7
      const in2d = trialEndDate >= windowStart2 && trialEndDate <= windowEnd2
      if (!in7d && !in2d) continue

      const reminderType = in2d ? 'trial_2d' : 'trial_7d'
      const daysLeft = in2d ? 2 : 7
      const dedupeKey = `trial-${reminderType}-${ts.trainer_id}-${todayStr}`
      const inserted = await tryInsertDedupe(supabase, reminderType, dedupeKey)
      if (!inserted) continue

      const profile = trialProfileMap.get(ts.trainer_id)

      if (!profile?.email) continue

      const firstName = profile.full_name?.split(' ')[0] || 'Trener'
      const planLabel = (ts.plan as string).charAt(0).toUpperCase() + (ts.plan as string).slice(1)
      const endStr = trialEndDate.toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })

      const html = buildTrialEndingEmail({
        trainerFirstName: firstName,
        daysLeft,
        planLabel,
        trialEndStr: endStr,
        billingUrl: `${url}/dashboard/billing`,
      })

      const r = await sendResendEmail({
        to: profile.email,
        subject: `UnitLift: tvoj trial istječe za ${daysLeft} dana`,
        html,
      })
      if (r.ok) trialReminderSent++
      else errors.push(`trial reminder ${ts.trainer_id}: ${r.errorKey}`)
    }
  } catch (e: any) {
    errors.push(`trial reminder block: ${e?.message || e}`)
  }

  return NextResponse.json({
    ok: true,
    checkinSent,
    pkgSent,
    paySent,
    trialReminderSent,
    meta: {
      timeZone: tz,
      todayStr,
      todayDow,
      checkinDueCount,
    },
    errors: errors.length ? errors : undefined,
  })
}
