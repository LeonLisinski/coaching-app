import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Use implicit flow so password-reset links work across different browsers/devices.
      // PKCE would break if the user requests reset in Chrome but clicks the link in Safari/mobile.
      flowType: 'implicit',
    },
  }
)