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
  const vercelCron = req.headers.get('x-vercel-cron')

  // Ako je CRON_SECRET postavljen, prihvati samo ispravan Bearer (Vercel Cron ga šalje automatski).
  // Bez secreta: dev bez auth-a ili samo Vercelov cron header (legacy).
  const authorized = secret
    ? auth === `Bearer ${secret}`
    : process.env.NODE_ENV === 'development' || !!vercelCron

  if (!authorized) {
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
  let checkinDueCount = 0
  const errors: string[] = []

  // ── Check-in reminders (clients) ───────────────────────────────────────────
  try {
    const { data: rows, error } = await supabase
      .from('clients')
      .select(
        `
        id,
        trainer_id,
        user_id,
        active,
        profiles!clients_user_id_fkey (full_name, email),
        checkin_config ( checkin_day )
      `,
      )
      .eq('active', true)

    if (error) throw error

    const cfgRows = (rows || []).map((r: any) => ({
      id: r.id as string,
      email: (r.profiles as any)?.email as string | undefined,
      name: (r.profiles as any)?.full_name as string | undefined,
      checkin_day: pickCheckinDay(r.checkin_config),
    }))

    const due = cfgRows.filter(c => c.checkin_day !== null && c.checkin_day === todayDow && c.email)
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

      const line =
        daysLeft === 0
          ? `Paket <strong>${escapeHtml(pkgName)}</strong> za <strong>${escapeHtml(clientName)}</strong> istječe <strong>danas</strong>.`
          : `Paket <strong>${escapeHtml(pkgName)}</strong> za <strong>${escapeHtml(clientName)}</strong> istječe za <strong>${daysLeft}</strong> dana (${escapeHtml(endDateStr)}).`

      const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#0b0a12;color:#e4e4e7;padding:24px;">
<p>Bok ${escapeHtml(trainer.full_name?.split(' ')[0] || 'trener')},</p>
<p>${line}</p>
<p><a href="${escapeHtml(url)}/dashboard/clients/${(cp as any).client_id}?tab=packages" style="color:#a78bfa;">Otvori pakete klijenta</a></p>
</body></html>`

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

      const rows = bundle.items
        .map(i => `<li>${escapeHtml(i.client)} — <strong>${i.amount}€</strong> na čekanju</li>`)
        .join('')
      const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#0b0a12;color:#e4e4e7;padding:24px;">
<p>Bok ${escapeHtml(bundle.name.split(' ')[0] || 'trener')},</p>
<p>Imaš <strong>${bundle.items.length}</strong> otvorenih uplata:</p>
<ul>${rows}</ul>
<p><a href="${escapeHtml(url)}/dashboard/financije" style="color:#a78bfa;">Otvori financije</a></p>
</body></html>`

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

  return NextResponse.json({
    ok: true,
    checkinSent,
    pkgSent,
    paySent,
    meta: {
      timeZone: tz,
      todayStr,
      todayDow,
      checkinDueCount,
    },
    errors: errors.length ? errors : undefined,
  })
}
