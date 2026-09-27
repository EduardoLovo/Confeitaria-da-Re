import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Cliente anônimo sem sessão, para ler dados públicos (catálogo, loja)
 * em Server Components. Respeita RLS como qualquer visitante.
 */
export function createPublicClient() {
  return createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
