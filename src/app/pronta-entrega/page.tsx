import type { Metadata } from 'next'

import { Cart } from '@/components/public/cart'
import { Catalog } from '@/components/public/catalog'
import { CategoryTabs } from '@/components/public/category-tabs'
import { ClosedNotice } from '@/components/public/closed-notice'
import { PageHeader } from '@/components/public/page-header'
import { getCatalog } from '@/lib/data/catalog'
import { getStoreInfo } from '@/lib/data/store'
import { toProductMap } from '@/lib/domain/catalog'

export const metadata: Metadata = {
  title: 'Delivery',
  description: 'Docinhos prontos para entrega ou retirada.',
}

export default async function ProntaEntregaPage() {
  const [store, categories] = await Promise.all([getStoreInfo(), getCatalog()])

  return (
    <>
      <PageHeader title="Delivery" storeName={store.settings.name}>
        {categories.length > 1 && (
          <CategoryTabs categories={categories.map(({ slug, name }) => ({ slug, name }))} />
        )}
      </PageHeader>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-32">
        {!store.isOpen && <ClosedNotice nextOpening={store.nextOpening} className="mb-6" />}

        {categories.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Nenhum docinho disponível no momento. Volte em breve 💕
          </p>
        ) : (
          <Catalog categories={categories} />
        )}
      </main>

      <Cart
        products={toProductMap(categories)}
        isOpen={store.isOpen}
        nextOpening={store.nextOpening}
        minOrderCents={store.settings.min_order_cents}
      />
    </>
  )
}
