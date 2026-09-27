import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { authRedirectFor, getAdminAuthState, safeAdminNext } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar no painel', robots: { index: false } }

export default async function LoginPage({ searchParams }: PageProps<'/admin/login'>) {
  const { next } = await searchParams
  const nextPath = typeof next === 'string' ? next : undefined

  // Já passou pela senha? Segue para o código, a configuração ou o painel.
  const state = await getAdminAuthState()
  if (state.status === 'ok') redirect(safeAdminNext(nextPath))
  if (state.status === 'needs_code' || state.status === 'needs_setup') {
    redirect(authRedirectFor(state, nextPath)!)
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Painel da loja</p>
        <h1 className="text-3xl font-semibold text-cocoa">Entrar</h1>
      </div>
      <LoginForm next={nextPath} />
    </main>
  )
}
