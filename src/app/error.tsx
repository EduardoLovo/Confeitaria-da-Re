'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-cocoa">Ops, algo deu errado</h1>
      <p className="text-muted-foreground">
        Não conseguimos carregar esta página agora. Tente de novo em instantes.
      </p>
      <Button size="xl" onClick={reset}>
        Tentar novamente
      </Button>
    </main>
  )
}
