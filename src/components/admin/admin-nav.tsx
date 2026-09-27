'use client'

import { ClipboardList, Cookie, Gift, MapPinned, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from 'cn'

const LINKS = [
  { href: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
  { href: '/admin/produtos', label: 'Produtos', icon: Cookie },
  { href: '/admin/encomendas', label: 'Encomendas', icon: Gift },
  { href: '/admin/bairros', label: 'Bairros', icon: MapPinned },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Seções do painel"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
