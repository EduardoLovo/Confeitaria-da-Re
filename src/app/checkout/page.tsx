import type { Metadata } from 'next'

import { CheckoutForm } from '@/components/public/checkout-form'
import { PageHeader } from '@/components/public/page-header'
import { getCatalog } from '@/lib/data/catalog'
import { getStoreInfo } from '@/lib/data/store'
import { toProductMap } from '@/lib/domain/catalog'
import { groupOpeningHours } from '@/lib/domain/store-hours'

export const metadata: Metadata = {
  title: 'Finalizar pedido',
  robots: { index: false },
}

export default async function CheckoutPage() {
  const [store, categories] = await Promise.all([getStoreInfo(), getCatalog()])

  return (
    <>
      <PageHeader title="Finalizar pedido" storeName={store.settings.name} backHref="/pronta-entrega" />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4">
        <CheckoutForm
          products={toProductMap(categories)}
          deliveryFeeCents={store.settings.delivery_fee_cents}
          isOpen={store.isOpen}
          nextOpening={store.nextOpening}
          minOrderCents={store.settings.min_order_cents}
          pickupAddress={store.settings.pickup_address}
          pickupHours={groupOpeningHours(store.hours)}
        />
      </main>
    </>
  )
}
