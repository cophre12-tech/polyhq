import { createClient } from '@supabase/supabase-js'

// Read auth-link params before the client consumes them: on load it parses the
// URL hash, stores the session and then clears the hash, and it emits
// PASSWORD_RECOVERY on a timer that can fire before React subscribes.
const hashParams = new URLSearchParams(
  typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
)
export const recoveryLinkInUrl = hashParams.get('type') === 'recovery'
// Set when Supabase redirects back with an expired or already-used link.
export const authLinkError = hashParams.get('error_description')

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
