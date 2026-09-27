import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type AdminSession = {
  supabase: ServerSupabase
  userId: string
  email: string | null
}

/**
 * Situação de quem acessa o painel:
 * - anonymous: não logado
 * - not_admin: logado, mas não está em admin_users
 * - needs_setup: admin que ainda não configurou a verificação em duas etapas
 * - needs_code: admin que entrou com a senha e falta o código do app autenticador
 * - ok: admin com sessão verificada (aal2) — é o que o RLS exige (is_admin())
 */
export type AdminAuthState =
  | { status: 'anonymous' }
  | { status: 'not_admin'; supabase: ServerSupabase }
  | { status: 'needs_setup'; supabase: ServerSupabase }
  | { status: 'needs_code'; supabase: ServerSupabase; factorId: string }
  | { status: 'ok'; session: AdminSession }

/** Estado do admin a partir de um cliente já existente (ex.: logo após o login com senha). */
export async function resolveAdminAuthState(supabase: ServerSupabase): Promise<AdminAuthState> {
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return { status: 'anonymous' }

  const { data: isMember } = await supabase.rpc('is_admin_member')
  if (!isMember) return { status: 'not_admin', supabase }

  if (claims.aal === 'aal2') {
    return {
      status: 'ok',
      session: { supabase, userId: claims.sub, email: typeof claims.email === 'string' ? claims.email : null },
    }
  }

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verified = factors?.totp.find((f) => f.status === 'verified')
  return verified ? { status: 'needs_code', supabase, factorId: verified.id } : { status: 'needs_setup', supabase }
}

export const getAdminAuthState = cache(async (): Promise<AdminAuthState> => resolveAdminAuthState(await createClient()))

/**
 * Sessão completa do admin (com o segundo fator), ou null.
 * Mesmo com isso, quem protege os dados de verdade é o RLS no banco.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const state = await getAdminAuthState()
  return state.status === 'ok' ? state.session : null
}

/** Só aceita redirecionar para dentro do /admin (evita open redirect). */
export function safeAdminNext(next: string | null | undefined): string {
  return next && next.startsWith('/admin') && !next.startsWith('//') && !next.startsWith('/admin/2fa')
    ? next
    : '/admin/pedidos'
}

/** Página do fluxo de login para cada situação (null = pode entrar no painel). */
export function authRedirectFor(state: AdminAuthState, next?: string): string | null {
  const q = next ? `?next=${encodeURIComponent(next)}` : ''
  switch (state.status) {
    case 'ok':
      return null
    case 'needs_code':
      return `/admin/2fa/verificar${q}`
    case 'needs_setup':
      return `/admin/2fa/configurar${q}`
    default:
      return `/admin/login${q}`
  }
}

/** Para páginas do painel: leva ao login, ao código ou à configuração do 2FA. */
export async function requireAdminPage(): Promise<AdminSession> {
  const state = await getAdminAuthState()
  const target = authRedirectFor(state)
  if (target || state.status !== 'ok') redirect(target ?? '/admin/login')
  return state.session
}

export class NotAdminError extends Error {
  constructor() {
    super('Sua sessão expirou. Entre novamente.')
  }
}

/** Para Server Actions: lança erro se não for admin com sessão verificada. */
export async function requireAdminAction(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new NotAdminError()
  return session
}
