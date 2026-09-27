import { LogOut, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { signOut } from '../login/actions'

/** Moldura das telas de verificação em duas etapas. */
export function TwoFactorShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-cocoa" aria-hidden>
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="text-3xl font-semibold text-cocoa">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-5 rounded-3xl border bg-card p-5">{children}</div>
      <form action={signOut} className="self-center">
        <Button type="submit" variant="ghost" size="sm">
          <LogOut /> Sair e entrar com outra conta
        </Button>
      </form>
    </main>
  )
}
