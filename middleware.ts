import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessible even when subscription is locked/canceled
const SUBSCRIPTION_FREE_PATHS = ['/dashboard/profile', '/dashboard/billing', '/choose-plan', '/login', '/register']

/** Paths that must work without a session (email links carry tokens in #hash or ?code — not visible to middleware). */
const PUBLIC_UNAUTH_PATHS = ['/login', '/register', '/client-auth', '/reset-password'] as const

function allowsUnauthenticated(pathname: string): boolean {
  return PUBLIC_UNAUTH_PATHS.some((p) => pathname.startsWith(p))
}

/** Logged-in users hitting these get sent to the dashboard (not client-auth / reset-password — different roles). */
function isAuthLandingPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register')
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

    const effectiveStatus = sub?.locked_at && new Date(sub.locked_at) <= new Date()
      ? 'locked'
      : sub?.status

    // Block access if locked or canceled
    if (effectiveStatus === 'locked' || effectiveStatus === 'canceled') {
      const url = request.nextUrl.clone()
      url.pathname = '/choose-plan'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|site.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png|sw.js|manifest.json).*)',
  ],
}
