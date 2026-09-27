import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Cliente para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do usuário (cookies) e respeita RLS.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado de um Server Component: não dá para gravar cookies aqui.
          // O proxy.ts já renova a sessão a cada requisição.
        }
      },
    },
  })
}
