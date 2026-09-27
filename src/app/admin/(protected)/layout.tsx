import { ExternalLink, LogOut } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminNav } from '@/components/admin/admin-nav'
import { OrdersRealtime } from '@/components/admin/orders-realtime'
import { Button } from '@/components/ui/button'
import { requireAdminPage } from '@/lib/auth'
import { getStoreInfo } from '@/lib/data/store'
import { signOut } from '../login/actions'

export const metadata: Metadata = {
  title: { default: 'Painel', template: '%s · Painel' },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const [session, store] = await Promise.all([requireAdminPage(), getStoreInfo()])

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Painel</p>
              <p className="truncate font-heading text-lg font-semibold text-cocoa">{store.settings.name}</p>
            </div>
            <div className="flex items-center gap-1">
              <OrdersRealtime />
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/" target="_blank" />}
                aria-label="Ver o site (abre em nova aba)"
              >
                <ExternalLink /> <span className="hidden sm:inline">Ver site</span>
              </Button>
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit" aria-label={`Sair (${session.email ?? ''})`}>
                  <LogOut /> <span className="hidden sm:inline">Sair</span>
                </Button>
              </form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5">{children}</main>
    </div>
  )
}
