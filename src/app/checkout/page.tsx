import type { Metadata } from 'next'

import { CheckoutForm } from '@/components/public/checkout-form'
import { PageHeader } from '@/components/public/page-header'
import { getCatalog } from '@/lib/data/catalog'
import { getStoreInfo } from '@/lib/data/store'
import { getDeliveryZones } from '@/lib/data/zones'
import { toProductMap } from '@/lib/domain/catalog'
import { groupOpeningHours } from '@/lib/domain/store-hours'

export const metadata: Metadata = {
  title: 'Finalizar pedido',
  robots: { index: false },
}

export default async function CheckoutPage() {
  const [store, categories, zones] = await Promise.all([
    getStoreInfo(),
    getCatalog(),
    getDeliveryZones(),
  ])

  return (
    <>
      <PageHeader title="Finalizar pedido" storeName={store.settings.name} backHref="/pronta-entrega" />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4">
        <CheckoutForm
          products={toProductMap(categories)}
          zones={zones}
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
