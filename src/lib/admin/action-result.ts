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

type DbError = { code?: string; message: string; details?: string | null; hint?: string | null }

/**
 * Códigos que indicam banco sem a última migration: coluna, tabela ou função
 * que o código usa ainda não existe (Postgres 42703/42P01/42883, PostgREST PGRST2xx).
 */
const SCHEMA_OUTDATED = new Set(['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

/** Erros de rede/serviço fora do ar: vale tentar de novo. */
const TRANSIENT = new Set(['57014', '53300', '08000', '08003', '08006', 'PGRST000', 'PGRST001', 'PGRST002'])

/** Mensagens amigáveis para erros comuns do Postgres/Supabase. */
export function dbFailed(error: DbError, context: string): ActionResult<never> {
  const code = error.code ?? ''
  if (code === '23505') return { ok: false, message: 'Já existe um item com esse nome.' }
  if (code === '23503') {
    return { ok: false, message: 'Não dá para excluir: ainda há itens ligados a este registro.' }
  }
  if (error.message === 'INVALID_STATUS_TRANSITION') {
    return { ok: false, message: 'Essa mudança de status não é permitida.' }
  }

  console.error(`[admin] ${context}`, error)

  if (SCHEMA_OUTDATED.has(code)) {
    return {
      ok: false,
      message: `O banco de dados está desatualizado em relação ao site (falta aplicar uma migration: rode "npm run db:push"). Detalhe: ${error.message}`,
    }
  }
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST303') {
    return { ok: false, message: 'Sem permissão para salvar. Sua sessão pode ter expirado: entre de novo no painel.' }
  }
  if (code === '23514') {
    return { ok: false, message: `Algum valor está fora do permitido. Confira os campos. (${error.message})` }
  }
  if (code === '23502') return { ok: false, message: 'Há um campo obrigatório vazio.' }
  if (code === '22001') return { ok: false, message: 'Algum texto passou do tamanho máximo.' }
  if (code.startsWith('22')) return { ok: false, message: 'Algum valor está em um formato inválido.' }
  if (TRANSIENT.has(code)) {
    return { ok: false, message: 'O banco de dados não respondeu. Verifique a internet e tente de novo em instantes.' }
  }

  return {
    ok: false,
    message: `Não foi possível ${context}.${code ? ` (código ${code})` : ''} Se persistir, envie este código para o suporte.`,
  }
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
