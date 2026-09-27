import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

/**
 * Cliente com a service_role: IGNORA RLS. Só pode ser importado no servidor
 * (garantido por `server-only`). Use apenas para operações que o público não
 * pode fazer diretamente, como criar pedidos e ler um pedido pelo UUID.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY (somente no servidor).')
  }

  return createClient<Database>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
