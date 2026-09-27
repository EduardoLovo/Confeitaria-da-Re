import type { z } from 'zod'

import { NotAdminError } from '@/lib/auth'
import { fieldErrors } from '@/lib/validation/order'

/** Resultado padrão das Server Actions do painel. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; errors?: Record<string, string> }

export function validationFailed(error: z.ZodError): ActionResult<never> {
  return { ok: false, message: 'Confira os campos destacados.', errors: fieldErrors(error) }
}

/** Mensagens amigáveis para erros comuns do Postgres/Supabase. */
export function dbFailed(error: { code?: string; message: string }, context: string): ActionResult<never> {
  if (error.code === '23505') return { ok: false, message: 'Já existe um item com esse nome.' }
  if (error.code === '23503') {
    return { ok: false, message: 'Não dá para excluir: ainda há itens ligados a este registro.' }
  }
  if (error.message === 'INVALID_STATUS_TRANSITION') {
    return { ok: false, message: 'Essa mudança de status não é permitida.' }
  }
  console.error(`[admin] ${context}`, error)
  return { ok: false, message: 'Não foi possível salvar. Tente novamente.' }
}

/** Envolve uma action: transforma "não é admin" e erros inesperados em ActionResult. */
export async function adminAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof NotAdminError) return { ok: false, message: error.message }
    // redirect()/notFound() do Next precisam continuar propagando.
    if (error instanceof Error && 'digest' in error) throw error
    console.error('[admin] erro inesperado', error)
    return { ok: false, message: 'Algo deu errado. Tente novamente.' }
  }
}
