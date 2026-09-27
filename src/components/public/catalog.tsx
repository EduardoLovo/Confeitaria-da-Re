'use client'

import { useState } from 'react'

import type { CatalogCategory, CatalogProduct } from '@/lib/domain/catalog'
import { ProductCard } from './product-card'
import { ProductSheet } from './product-sheet'

export function Catalog({ categories }: { categories: CatalogCategory[] }) {
  const [selected, setSelected] = useState<CatalogProduct | null>(null)

  return (
    <>
      <div className="space-y-8">
        {categories.map((category, ci) => (
          <section
            key={category.id}
            id={category.slug}
            aria-labelledby={`h-${category.slug}`}
            className="scroll-mt-36"
          >
            <h2 id={`h-${category.slug}`} className="mb-3 text-2xl font-semibold text-cocoa">
              {category.name}
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {category.products.map((product, pi) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={setSelected}
                  priority={ci === 0 && pi < 4}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ProductSheet product={selected} onClose={() => setSelected(null)} />
    </>
  )
}
