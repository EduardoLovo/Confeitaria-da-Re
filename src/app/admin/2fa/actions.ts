'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getAdminAuthState, safeAdminNext } from '@/lib/auth'
import { getStoreInfo } from '@/lib/data/store'

const codeSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().length(6, 'O código tem 6 números.'))

const WRONG_CODE = 'Código incorreto ou expirado. Confira o app e digite o código atual.'

export type Enrollment = { factorId: string; qrCode: string; secret: string; uri: string }

/**
 * Primeiro acesso: cria o fator TOTP (ainda não verificado) e devolve o que a
 * tela precisa: QR code, chave para digitar e o link otpauth:// (no iPhone
 * abre o app Senhas direto).
 */
export async function startEnrollment(): Promise<{ ok: true; data: Enrollment } | { ok: false; message: string }> {
  const state = await getAdminAuthState()
  if (state.status !== 'needs_setup') return { ok: false, message: 'A verificação em duas etapas já está configurada.' }
  const { supabase } = state

  // Tentativas anteriores não concluídas: remove para começar do zero.
  const { data: factors } = await supabase.auth.mfa.listFactors()
  for (const factor of factors?.all ?? []) {
    if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
  }

  const { settings } = await getStoreInfo()
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Painel da loja',
    issuer: settings.name,
  })
  if (error || !data || data.type !== 'totp') {
    console.error('[2fa] enroll', error)
    return { ok: false, message: 'Não foi possível iniciar a configuração. Tente novamente.' }
  }

  return {
    ok: true,
    data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri },
  }
}

export type CodeState = { error: string | null }

/** Confirma o primeiro código (ativa o 2FA) e já entra no painel. */
export async function confirmEnrollment(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const code = codeSchema.safeParse(formData.get('code') ?? '')
  if (!code.success) return { error: code.error.issues[0].message }
  const factorId = z.uuid().safeParse(formData.get('factorId'))
  if (!factorId.success) return { error: 'Configuração expirada. Recarregue a página.' }

  const state = await getAdminAuthState()
  if (state.status !== 'needs_setup') return { error: 'Configuração expirada. Recarregue a página.' }

  const { error } = await state.supabase.auth.mfa.challengeAndVerify({ factorId: factorId.data, code: code.data })
  if (error) return { error: WRONG_CODE }

  redirect(safeAdminNext(String(formData.get('next') ?? '')))
}

/** Login do dia a dia: confere o código do app autenticador. */
export async function verifyCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const code = codeSchema.safeParse(formData.get('code') ?? '')
  if (!code.success) return { error: code.error.issues[0].message }

  const state = await getAdminAuthState()
  if (state.status === 'ok') redirect(safeAdminNext(String(formData.get('next') ?? '')))
  if (state.status !== 'needs_code') return { error: 'Sua sessão expirou. Entre novamente com e-mail e senha.' }

  const { error } = await state.supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.data })
  if (error) {
    return { error: error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : WRONG_CODE }
  }

  redirect(safeAdminNext(String(formData.get('next') ?? '')))
}
