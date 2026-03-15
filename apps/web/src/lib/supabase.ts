import { createClient } from '@supabase/supabase-js'
import type { Database } from '@adc/shared-types'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing Supabase env vars. Check apps/web/.env.local')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 2,  // rate-limit realtime events on client
    },
  },
  db: {
    schema: 'public',
  },
})

/** Supabase Realtime channel for driver location broadcast */
export const driversChannel = supabase.channel('adc-driver-locations', {
  config: { broadcast: { self: false } },
})
