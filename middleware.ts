import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessible even when subscription is locked/canceled
const SUBSCRIPTION_FREE_PATHS = ['/dashboard/profile', '/dashboard/billing', '/choose-plan', '/login', '/register']

/** Paths that must work without a session (email links carry tokens in #hash or ?code — not visible to middleware). */
const PUBLIC_UNAUTH_PATHS = ['/login', '/register', '/client-auth', '/reset-password'] as const

// Subscription status is cached in a short-lived httpOnly cookie to avoid a DB round-trip on every page.
// TTL of 5 minutes: status changes (Stripe webhook) propagate within one refresh cycle.
const SUB_CACHE_COOKIE = 'x-sub-cache'
const SUB_CACHE_TTL_MS = 5 * 60 * 1000

function allowsUnauthenticated(pathname: string): boolean {
  return PUBLIC_UNAUTH_PATHS.some((p) => pathname.startsWith(p))
}

/** Logged-in users hitting these get sent to the dashboard (not client-auth / reset-password — different roles). */
function isAuthLandingPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register')
}

/** Read cached subscription status. Returns null if missing or stale. */
function readSubCache(request: NextRequest, userId: string): string | null {
  const raw = request.cookies.get(SUB_CACHE_COOKIE)?.value
  if (!raw) return null
  const [cachedId, status, tsStr] = raw.split(':')
  if (cachedId !== userId) return null
  if (Date.now() - Number(tsStr) > SUB_CACHE_TTL_MS) return null
  return status ?? null
}

function writeSubCache(response: NextResponse, userId: string, status: string) {
  response.cookies.set(SUB_CACHE_COOKIE, `${userId}:${status}:${Date.now()}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SUB_CACHE_TTL_MS / 1000),
  })
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  // Unauthenticated → login (except public pages; client-auth must load to read #access_token from email)
  if (!user && !allowsUnauthenticated(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated on root/login/register → dashboard (not /client-auth or /reset-password)
  if (user && isAuthLandingPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Require verified email before allowing dashboard access
  if (user && !user.email_confirmed_at && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('verify', 'required')
    return NextResponse.redirect(url)
  }

  // ── Subscription guard (trainers only; skip client-auth / reset-password / login-area) ──
  if (
    user &&
    !allowsUnauthenticated(pathname) &&
    !SUBSCRIPTION_FREE_PATHS.some((p) => pathname.startsWith(p))
  ) {
    // Check short-lived cache first to avoid a DB round-trip on every page navigation
    const cached = readSubCache(request, user.id)

    let effectiveStatus: string | undefined

    if (cached) {
      effectiveStatus = cached
    } else {
      const adminDb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )

      const { data: sub } = await adminDb
        .from('subscriptions')
        .select('status, locked_at, current_period_end, trial_end')
        .eq('trainer_id', user.id)
        .maybeSingle()

      // Auto-lock if locked_at has passed
      if (sub?.locked_at && new Date(sub.locked_at) <= new Date()) {
        await adminDb.from('subscriptions')
          .update({ status: 'locked', updated_at: new Date().toISOString() })
          .eq('trainer_id', user.id)
          .eq('status', 'past_due')
      }

      effectiveStatus = sub?.locked_at && new Date(sub.locked_at) <= new Date()
        ? 'locked'
        : sub?.status

      // Persist in cache for subsequent requests
      if (effectiveStatus) {
        writeSubCache(supabaseResponse, user.id, effectiveStatus)
      }
    }

    // Block access if locked or canceled
    if (effectiveStatus === 'locked' || effectiveStatus === 'canceled') {
      const url = request.nextUrl.clone()
      url.pathname = '/choose-plan'
      const redirect = NextResponse.redirect(url)
      // Clear cache so the trainer can retry immediately after re-subscribing
      redirect.cookies.delete(SUB_CACHE_COOKIE)
      return redirect
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|site.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png|sw.js|manifest.json).*)',
  ],
}
