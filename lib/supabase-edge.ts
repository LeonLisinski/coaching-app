/**
 * Supabase Edge Functions for this project (same host as NEXT_PUBLIC_SUPABASE_URL).
 */
export function edgeFunctionUrl(name: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  return `${base.replace(/\/$/, '')}/functions/v1/${name}`
}
