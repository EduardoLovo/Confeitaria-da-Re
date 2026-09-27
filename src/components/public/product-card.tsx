import { Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CatalogProduct } from '@/lib/domain/catalog'
import { formatBRL } from '@/lib/format'
import { ProductImage } from './product-image'

type Props = {
  product: CatalogProduct
  onSelect: (product: CatalogProduct) => void
  priority?: boolean
}

export function ProductCard({ product, onSelect, priority }: Props) {
  const soldOut = !product.is_available

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-xs transition hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={`${product.name}, ${formatBRL(product.price_cents)}${soldOut ? ', esgotado' : ''}`}
    >
      <div className="relative">
        <ProductImage
          path={product.image_path}
          alt=""
          sizes="(min-width: 768px) 240px, 50vw"
          className="aspect-square"
          priority={priority}
          muted={soldOut}
        />
        {soldOut && (
          <Badge variant="secondary" className="absolute top-2 left-2 bg-card/95 text-cocoa">
            Esgotado
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="font-sans text-sm leading-snug font-bold">{product.name}</h3>
        {product.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold text-cocoa">{formatBRL(product.price_cents)}</span>
          {!soldOut && (
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition group-hover:scale-105"
            >
              <Plus className="size-4" />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
