import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type AdminSession = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  email: string | null
}

/**
 * Sessão do admin, ou null se não estiver logado ou não estiver em admin_users.
 * Mesmo com isso, quem protege os dados de verdade é o RLS no banco.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return null

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
  }
})

/** Para páginas: manda para o login se não for admin. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return session
}

export class NotAdminError extends Error {
  constructor() {
    super('Sua sessão expirou. Entre novamente.')
  }
}

/** Para Server Actions: lança erro se não for admin. */
export async function requireAdminAction(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new NotAdminError()
  return session
}
