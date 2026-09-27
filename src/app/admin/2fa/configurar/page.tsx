import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { authRedirectFor, getAdminAuthState, safeAdminNext } from '@/lib/auth'
import { TwoFactorShell } from '../shell'
import { EnrollForm } from './enroll-form'

export const metadata: Metadata = { title: 'Ativar verificação em duas etapas', robots: { index: false } }

export default async function ConfigureTwoFactorPage({ searchParams }: PageProps<'/admin/2fa/configurar'>) {
  const { next } = await searchParams
  const nextPath = typeof next === 'string' ? next : undefined

  const state = await getAdminAuthState()
  if (state.status === 'ok') redirect(safeAdminNext(nextPath))
  if (state.status !== 'needs_setup') redirect(authRedirectFor(state, nextPath) ?? '/admin/login')

  return (
    <TwoFactorShell
      title="Proteja o painel"
      description="Além da senha, o painel vai pedir um código de 6 números gerado no seu celular. Assim, mesmo que alguém descubra a senha, não consegue entrar. Você só faz esta configuração uma vez."
    >
      <EnrollForm next={nextPath} />
    </TwoFactorShell>
  )
}
