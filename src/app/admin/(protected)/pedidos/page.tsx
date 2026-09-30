import { Store, Truck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cn } from 'cn'

import { PaymentBadge } from '@/components/admin/payment-badge'
import { StatusBadge } from '@/components/admin/status-badge'
import { requireAdminPage } from '@/lib/auth'
import { FINAL_STATUSES, STATUS_LABEL } from '@/lib/domain/order-status'
import { formatBRL, formatDateTime, formatTime, localDateKey } from '@/lib/format'
import type { OrderStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Pedidos' }

const FILTERS: { value: string; label: string }[] = [
  { value: 'ativos', label: 'Em andamento' },
  { value: 'received', label: STATUS_LABEL.received },
  { value: 'confirmed', label: STATUS_LABEL.confirmed },
  { value: 'saiu', label: 'Saiu / Pronto' },
  { value: 'completed', label: STATUS_LABEL.completed },
  { value: 'cancelled', label: STATUS_LABEL.cancelled },
  { value: 'awaiting_payment', label: STATUS_LABEL.awaiting_payment },
  { value: 'todos', label: 'Todos' },
]

function statusesFor(filter: string): OrderStatus[] | null {
  switch (filter) {
    case 'todos':
      return null
    case 'saiu':
      return ['out_for_delivery', 'ready_for_pickup']
    case 'received':
    case 'confirmed':
    case 'completed':
    case 'cancelled':
    case 'awaiting_payment':
      return [filter]
    default:
      // "Aguardando pagamento" fica de fora: só entra na fila depois de pago.
      return ['received', 'confirmed', 'out_for_delivery', 'ready_for_pickup']
  }
}

export default async function OrdersPage({ searchParams }: PageProps<'/admin/pedidos'>) {
  const { supabase } = await requireAdminPage()
  const { status } = await searchParams
  const filter = typeof status === 'string' && FILTERS.some((f) => f.value === status) ? status : 'ativos'
  const statuses = statusesFor(filter)

  let query = supabase
    .from('orders')
    .select(
      'id, number, customer_name, fulfillment, zone_name_snapshot, total_cents, status, created_at, payment_method, payment_status',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  if (statuses) query = query.in('status', statuses)
  const { data: orders, error } = await query
  if (error) throw new Error(error.message)

  const today = localDateKey(new Date())

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-cocoa">Pedidos</h1>

      <nav aria-label="Filtrar por status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'ativos' ? '/admin/pedidos' : `/admin/pedidos?status=${f.value}`}
            aria-current={filter === f.value ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap',
              filter === f.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          Nenhum pedido {filter === 'ativos' ? 'em andamento' : 'neste filtro'}.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((o) => {
            const isToday = localDateKey(o.created_at) === today
            return (
              <li key={o.id}>
                <Link
                  href={`/admin/pedidos/${o.id}`}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border bg-card p-3 transition hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    o.status === 'received' && 'border-rose ring-2 ring-rose/50',
                    o.status === 'cancelled' && o.payment_status === 'paid'
                      ? 'border-destructive ring-2 ring-destructive/40'
                      : (FINAL_STATUSES.includes(o.status) || o.status === 'awaiting_payment') && 'opacity-75',
                  )}
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-cocoa"
                    title={o.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'}
                  >
                    {o.fulfillment === 'delivery' ? <Truck className="size-5" /> : <Store className="size-5" />}
                    <span className="sr-only">{o.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <strong className="tabular-nums">#{o.number}</strong>
                      <span className="truncate">{o.customer_name}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isToday ? `Hoje, ${formatTime(o.created_at)}` : formatDateTime(o.created_at)}
                      {o.zone_name_snapshot && ` · ${o.zone_name_snapshot}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={o.status} />
                    <span className="flex items-center gap-1.5">
                      <PaymentBadge
                        status={o.status}
                        paymentMethod={o.payment_method}
                        paymentStatus={o.payment_status}
                        className="h-5 px-2 text-[0.7rem]"
                      />
                      <span className="text-sm font-semibold tabular-nums">{formatBRL(o.total_cents)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
