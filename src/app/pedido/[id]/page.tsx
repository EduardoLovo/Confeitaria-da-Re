import { CircleCheck, MapPin, Store } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { AutoRefresh } from '@/components/public/auto-refresh'
import { OrderProgress } from '@/components/public/order-progress'
import { RememberOrder } from '@/components/public/remember-order'
import { WhatsappFollowButton } from '@/components/public/whatsapp-follow-button'
import { getPublicOrder } from '@/lib/data/orders'
import { getStoreInfo } from '@/lib/data/store'
import { FINAL_STATUSES, STATUS_LABEL } from '@/lib/domain/order-status'
import { paymentLabel } from '@/lib/domain/payment'
import { groupOpeningHours } from '@/lib/domain/store-hours'
import { formatBRL, formatDateTime } from '@/lib/format'
import { waLink } from '@/lib/whatsapp/wa-link'

export const metadata: Metadata = {
  title: 'Seu pedido',
  robots: { index: false, follow: false },
}

export default async function OrderPage({ params }: PageProps<'/pedido/[id]'>) {
  const { id } = await params
  const [order, store] = await Promise.all([getPublicOrder(id), getStoreInfo()])
  if (!order) notFound()

  const firstName = order.customer_name.split(/\s+/)[0]
  const isFinal = FINAL_STATUSES.includes(order.status)
  const followHref = waLink(store.settings.whatsapp, `Olá! Quero acompanhar meu pedido #${order.number}`)

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-8 pb-12">
      {/* Enquanto o pedido anda, a página se atualiza sozinha. */}
      {!isFinal && <AutoRefresh intervalMs={30_000} />}
      <RememberOrder id={order.id} number={order.number} createdAt={order.created_at} status={order.status} />

      <header className="flex flex-col items-center gap-2 text-center">
        <CircleCheck className="size-14 text-success" aria-hidden />
        <h1 className="text-3xl font-semibold text-cocoa">
          {order.status === 'cancelled' ? 'Pedido cancelado' : `Obrigada, ${firstName}!`}
        </h1>
        <p className="text-muted-foreground">
          Pedido <strong className="text-foreground">#{order.number}</strong> ·{' '}
          {formatDateTime(order.created_at)}
        </p>
        <p className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold" aria-live="polite">
          Status: {STATUS_LABEL[order.status]}
        </p>
      </header>

      {!isFinal && (
        <WhatsappFollowButton
          orderId={order.id}
          href={followHref}
          alreadyFollowing={order.wants_whatsapp_updates}
        />
      )}

      <Card title="Andamento">
        <OrderProgress status={order.status} fulfillment={order.fulfillment} />
      </Card>

      <Card title="Itens">
        <ul className="space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                <strong className="tabular-nums">{item.quantity}×</strong> {item.name_snapshot}
                {item.note && <span className="block text-xs text-muted-foreground">Obs.: {item.note}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatBRL(item.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t pt-3 text-sm">
          <Row label="Subtotal" value={formatBRL(order.subtotal_cents)} />
          <Row
            label="Taxa de entrega"
            value={order.fulfillment === 'pickup' ? 'Grátis' : formatBRL(order.delivery_fee_cents)}
          />
          <Row label="Total" value={formatBRL(order.total_cents)} strong />
        </dl>
      </Card>

      <Card title={order.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'}>
        {order.fulfillment === 'delivery' ? (
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-cocoa" aria-hidden />
            <span>
              {order.street}, {order.street_number}
              {order.complement && ` — ${order.complement}`}
              <br />
              {order.zone_name_snapshot}
            </span>
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            {store.settings.pickup_address && (
              <p className="flex items-start gap-2">
                <Store className="mt-0.5 size-4 shrink-0 text-cocoa" aria-hidden />
                <span>{store.settings.pickup_address}</span>
              </p>
            )}
            <dl className="space-y-0.5 text-muted-foreground">
              {groupOpeningHours(store.hours).map((g) => (
                <Row key={g.days} label={g.days} value={g.hours} />
              ))}
            </dl>
          </div>
        )}
        <dl className="space-y-1 border-t pt-3 text-sm">
          <Row label="Pagamento" value={paymentLabel(order.payment_method, order.fulfillment)} />
          {order.change_for_cents && <Row label="Troco para" value={formatBRL(order.change_for_cents)} />}
        </dl>
        {order.notes && <p className="text-sm text-muted-foreground">Obs.: {order.notes}</p>}
      </Card>

      <Link
        href="/"
        className="text-center text-sm font-semibold text-cocoa underline underline-offset-4"
      >
        Voltar para o início
      </Link>
    </main>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-cocoa">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'pt-1 text-base font-bold' : ''}`}>
      <dt className="capitalize">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
