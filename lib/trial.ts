import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A trainer is eligible for the 14-day free trial only if they have NEVER
 * used one before, as recorded in `profiles.trial_used_at`. This flag is set
 * on the FIRST successful Stripe checkout that includes a trial, and is
 * NEVER cleared — even if the user cancels and re-registers.
 */
export async function isTrialEligible(
  adminDb: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await adminDb
    .from('profiles')
    .select('trial_used_at')
    .eq('id', userId)
    .maybeSingle()

  return !profile?.trial_used_at
}

/** Mark the trial as used. Idempotent — won't overwrite an existing timestamp. */
export async function markTrialUsed(
  adminDb: SupabaseClient,
  userId: string,
  startedAt?: Date,
): Promise<void> {
  // Use COALESCE so we never overwrite the original trial timestamp
  const at = (startedAt ?? new Date()).toISOString()
  await adminDb.rpc('mark_trial_used_once', { p_user_id: userId, p_at: at })
    .then(() => {})
    .catch(async () => {
      // Fallback: plain update if RPC isn't deployed yet
      const { data: profile } = await adminDb
        .from('profiles')
        .select('trial_used_at')
        .eq('id', userId)
        .maybeSingle()
      if (!profile?.trial_used_at) {
        await adminDb.from('profiles').update({ trial_used_at: at }).eq('id', userId)
      }
    })
}
