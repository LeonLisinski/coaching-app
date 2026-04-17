/**
 * Public URL where clients land from invite / password-reset emails to set a password.
 * Set NEXT_PUBLIC_CLIENT_AUTH_URL in production (e.g. https://app.unitlift.com/client-auth).
 *
 * Supabase Dashboard → Authentication → URL configuration:
 * - Add this URL to "Redirect URLs".
 * - Optional: use as redirect in Invite / Recovery email templates.
 */
export function getClientAuthUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_CLIENT_AUTH_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site) return `${site.replace(/\/$/, '')}/client-auth`

  return 'https://app.unitlift.com/client-auth'
}
