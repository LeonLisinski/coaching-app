import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResendEmail } from '@/lib/resend-server'
import {
  daysFromTodayToEndDate,
  getIsoWeekFromYmd,
  getReminderCalendar,
} from '@/lib/reminder-calendar'
import { escapeHtml } from '@/lib/html-escape'
import { buildCheckinReminderEmailHtml } from '@/lib/email-checkin-reminder-html'
import { cronCheckinReminder, reminderGreetingLine } from '@/lib/reminder-email-copy'
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
  try {
    // Filter checkin_day at DB level (avoids loading all active clients globally).
    // Using checkin_config!inner ensures only clients WITH a matching config row are returned.
    const { data: rows, error } = await supabase
      .from('checkin_config')
      .select(
        `
        checkin_day,
        clients!inner (
          id,
          trainer_id,
          user_id,
          active,
          profiles:profiles!clients_user_id_fkey (full_name, email)
        )
      `,
      )
      .eq('checkin_day', todayDow)
      .eq('clients.active', true)

    if (error) throw error

    const cfgRows = (rows || []).map((r: any) => {
      const client = r.clients as any
      return {
        id: client.id as string,
        email: client.profiles?.email as string | undefined,
        name: client.profiles?.full_name as string | undefined,
        checkin_day: r.checkin_day as number,
      }
    }).filter(c => c.email)

    const due = cfgRows
    checkinDueCount = due.length
    if (due.length) {
      const ids = due.map(c => c.id)
      // Samo check-ini za današnji datum — bez učitavanja cijele povijesti za te klijente
      const { data: todayRows } = await supabase
        .from('checkins')
        .select('client_id')
        .in('client_id', ids)
        .eq('date', todayStr)

      const submittedToday = new Set((todayRows || []).map(r => r.client_id))

      for (const c of due) {
        if (submittedToday.has(c.id)) continue

        const dedupeKey = `checkin-${c.id}-${todayStr}`
        const inserted = await tryInsertDedupe(supabase, 'checkin', dedupeKey)
        if (!inserted) continue

        const nameRaw = c.name?.split(' ')[0] || ''
        const greet = reminderGreetingLine('hr', nameRaw)
        const line2 = escapeHtml(cronCheckinReminder.bodyLine)
        const html = buildCheckinReminderEmailHtml({
          lang: 'hr',
          title: cronCheckinReminder.title,
          bodyHtml: `<p style="margin:0 0 10px 0;font-size:15px;color:#334155;line-height:1.55;">${greet}</p><p style="margin:0;font-size:15px;color:#334155;line-height:1.55;">${line2}</p>`,
        })

        const r = await sendResendEmail({
          to: c.email!,
          subject: cronCheckinReminder.subject,
          html,
        })
        if (r.ok) checkinSent++
        else errors.push(`checkin ${c.id}: ${r.errorKey}`)
      }
    }
  } catch (e: any) {
    errors.push(`checkin block: ${e?.message || e}`)
  }

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

      // Check email preference before sending
      const { data: pref } = await supabase
        .from('trainer_notification_prefs')
        .select('email_enabled')
        .eq('trainer_id', (cp as any).trainer_id)
        .eq('type', 'package')
        .maybeSingle()
      // Default: email enabled for packages if no pref row exists
      const emailEnabled = pref ? pref.email_enabled : true
      if (!emailEnabled) { pkgSent++; continue }

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
        items: bundle.items,
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', ts.trainer_id)
        .maybeSingle()

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
