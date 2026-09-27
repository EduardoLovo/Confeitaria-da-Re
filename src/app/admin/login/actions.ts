'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

export type LoginState = { error: string | null; email: string }

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido').trim(),
  password: z.string().min(1, 'Informe a senha'),
  next: z.string().optional(),
})

/** Só aceita redirecionar para dentro do /admin (evita open redirect). */
function safeNext(next: string | undefined): string {
  return next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin/pedidos'
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  const email = String(formData.get('email') ?? '')
  if (!parsed.success) return { error: parsed.error.issues[0].message, email }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) {
    return {
      error:
        error.code === 'invalid_credentials'
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente novamente em instantes.',
      email,
    }
  }

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) {
    await supabase.auth.signOut()
    return { error: 'Este usuário não tem acesso ao painel.', email }
  }

  redirect(safeNext(parsed.data.next))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
