import { ChevronLeft, MapPin, MessageCircle, Phone, Store, Truck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { StatusBadge } from '@/components/admin/status-badge'
import { requireAdminPage } from '@/lib/auth'
import { STATUS_LABEL } from '@/lib/domain/order-status'
import { paymentLabel } from '@/lib/domain/payment'
import { formatBRL, formatDateTime, maskCEP, maskPhoneBR } from '@/lib/format'
import { waLink } from '@/lib/whatsapp/wa-link'
import { StatusActions } from './status-actions'

export const metadata: Metadata = { title: 'Pedido' }

export default async function OrderDetailPage({ params }: PageProps<'/admin/pedidos/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const { supabase } = await requireAdminPage()

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `*, items:order_items (id, name_snapshot, unit_price_cents, quantity, line_total_cents, note, sort_order),
       history:order_status_history (id, from_status, to_status, changed_at)`,
    )
    .eq('id', id)
    .order('sort_order', { referencedTable: 'order_items' })
    .order('changed_at', { referencedTable: 'order_status_history' })
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!order) notFound()

  const isDelivery = order.fulfillment === 'delivery'

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/pedidos" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-cocoa">
        <ChevronLeft className="size-4" aria-hidden /> Pedidos
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-cocoa">Pedido #{order.number}</h1>
        <StatusBadge status={order.status} className="h-7 text-sm" />
        <p className="w-full text-sm text-muted-foreground">
          {formatDateTime(order.created_at)} · {isDelivery ? 'Entrega' : 'Retirada'}
          {order.wants_whatsapp_updates && ' · 💬 quer acompanhar pelo WhatsApp'}
        </p>
      </header>

      <StatusActions
        orderId={order.id}
        orderNumber={order.number}
        status={order.status}
        fulfillment={order.fulfillment}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Cliente">
          <p className="text-lg font-semibold">{order.customer_name}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={waLink(order.customer_phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
            >
              <MessageCircle className="size-4" aria-hidden /> {maskPhoneBR(order.customer_phone)}
            </a>
            <a
              href={`tel:+55${order.customer_phone}`}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
            >
              <Phone className="size-4" aria-hidden /> Ligar
            </a>
          </div>
        </Card>

        <Card title={isDelivery ? 'Entrega' : 'Retirada'} icon={isDelivery ? <Truck /> : <Store />}>
          {isDelivery ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-cocoa" aria-hidden />
              <span>
                {order.street}, {order.street_number}
                {order.complement && ` — ${order.complement}`}
                <br />
                <strong>{order.zone_name_snapshot}</strong>
                {order.cep && ` · CEP ${maskCEP(order.cep)}`}
                {order.address_reference && (
                  <>
                    <br />
                    <span className="text-muted-foreground">Ref.: {order.address_reference}</span>
                  </>
                )}
              </span>
            </p>
          ) : (
            <p>A cliente vai retirar na loja.</p>
          )}
        </Card>
      </div>

      <Card title="Itens">
        <ul className="divide-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <span>
                <strong className="tabular-nums">{item.quantity}×</strong> {item.name_snapshot}
                <span className="text-xs text-muted-foreground"> ({formatBRL(item.unit_price_cents)} cada)</span>
                {item.note && <span className="block text-sm font-semibold text-cocoa">Obs.: {item.note}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatBRL(item.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t pt-3">
          <Row label="Subtotal" value={formatBRL(order.subtotal_cents)} />
          <Row label="Taxa de entrega" value={isDelivery ? formatBRL(order.delivery_fee_cents) : '—'} />
          <Row label="Total" value={formatBRL(order.total_cents)} strong />
        </dl>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Pagamento">
          <p className="font-semibold">{paymentLabel(order.payment_method, order.fulfillment)}</p>
          {order.change_for_cents && (
            <p>
              Troco para <strong>{formatBRL(order.change_for_cents)}</strong> (levar{' '}
              {formatBRL(order.change_for_cents - order.total_cents)})
            </p>
          )}
          {order.notes && (
            <p className="rounded-xl bg-secondary p-3">
              <strong>Obs. do pedido:</strong> {order.notes}
            </p>
          )}
        </Card>

        <Card title="Histórico">
          <ol className="space-y-1.5 text-sm">
            {order.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>{STATUS_LABEL[h.to_status]}</span>
                <time className="text-muted-foreground tabular-nums" dateTime={h.changed_at}>
                  {formatDateTime(h.changed_at)}
                </time>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm">
      <h2 className="flex items-center gap-2 font-sans text-sm font-bold tracking-wide text-muted-foreground uppercase [&_svg]:size-4">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
