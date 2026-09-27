import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  title: string
  storeName: string
  /** Para onde a seta de voltar leva. Padrão: início. */
  backHref?: string
  /** Conteúdo extra que fica fixo junto do cabeçalho (ex.: abas de categoria). */
  children?: ReactNode
}

/** Cabeçalho fixo das páginas internas do site público. */
export function PageHeader({ title, storeName, backHref = '/', children }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex items-center gap-2 py-3">
          <Link
            href={backHref}
            className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Voltar"
          >
            <ChevronLeft className="size-6" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {storeName}
            </p>
            <h1 className="truncate text-xl leading-tight font-semibold text-cocoa">{title}</h1>
          </div>
        </div>
        {children}
      </div>
    </header>
  )
}
