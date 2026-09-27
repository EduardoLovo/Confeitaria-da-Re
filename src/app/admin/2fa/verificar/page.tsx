import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { authRedirectFor, getAdminAuthState, safeAdminNext } from '@/lib/auth'
import { TwoFactorShell } from '../shell'
import { VerifyForm } from './verify-form'

export const metadata: Metadata = { title: 'Código de verificação', robots: { index: false } }

export default async function VerifyTwoFactorPage({ searchParams }: PageProps<'/admin/2fa/verificar'>) {
  const { next } = await searchParams
  const nextPath = typeof next === 'string' ? next : undefined

  const state = await getAdminAuthState()
  if (state.status === 'ok') redirect(safeAdminNext(nextPath))
  if (state.status !== 'needs_code') redirect(authRedirectFor(state, nextPath) ?? '/admin/login')

  return (
    <TwoFactorShell
      title="Código de verificação"
      description="Abra o app Senhas (ou o seu app autenticador) no celular e digite o código de 6 números do painel."
    >
      <VerifyForm next={nextPath} />
      <p className="text-center text-xs text-muted-foreground">
        Perdeu o celular? Peça ao responsável técnico para redefinir a verificação em duas etapas.
      </p>
    </TwoFactorShell>
  )
}
