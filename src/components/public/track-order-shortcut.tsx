'use client'

import { ChevronRight, PackageSearch } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { formatDateTime, formatTime, localDateKey } from '@/lib/format'
import { ordersToTrack, useRecentOrders, useRecentOrdersHydrated } from '@/stores/recent-orders'

/** Atalho na Home para voltar ao acompanhamento dos pedidos feitos neste aparelho. */
export function TrackOrderShortcut() {
  const hydrated = useRecentOrdersHydrated()
  const orders = useRecentOrders((s) => s.orders)
  // "Agora" fixado no primeiro render: o atalho não precisa ser recalculado a cada instante.
  const [now] = useState(() => Date.now())

  if (!hydrated) return null
  const toTrack = ordersToTrack(orders, now)
  if (toTrack.length === 0) return null

  const today = localDateKey(new Date(now))

  return (
    <section aria-label="Seus pedidos" className="flex flex-col gap-2">
      {toTrack.map((order) => (
        <Link
          key={order.id}
          href={`/pedido/${order.id}`}
          className="flex items-center gap-3 rounded-3xl border-2 border-rose bg-card p-4 shadow-sm transition hover:shadow-md focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-cocoa" aria-hidden>
            <PackageSearch className="size-6" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Acompanhar meu pedido #{order.number}</span>
            <span className="block text-sm text-muted-foreground">
              Feito{' '}
              {localDateKey(order.createdAt) === today
                ? `hoje às ${formatTime(order.createdAt)}`
                : `em ${formatDateTime(order.createdAt)}`}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-cocoa" aria-hidden />
        </Link>
      ))}
    </section>
  )
}
