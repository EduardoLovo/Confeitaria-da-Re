import type { CatalogProduct, ProductMap } from './catalog'
import { subtotal } from './pricing'

export const MAX_ITEM_QUANTITY = 99
export const MAX_NOTE_LENGTH = 200

export type CartLine = {
  id: string
  productId: string
  quantity: number
  note: string
}

export type ResolvedCartLine = {
  line: CartLine
  /** null quando o produto saiu do cardápio. */
  product: CatalogProduct | null
  available: boolean
  lineTotalCents: number
}

export type ResolvedCart = {
  lines: ResolvedCartLine[]
  itemCount: number
  subtotalCents: number
  hasUnavailable: boolean
}

/**
 * Cruza o carrinho (só ids e quantidades) com o catálogo atual.
 * Preço e nome vêm SEMPRE do catálogo; itens indisponíveis não somam.
 */
export function resolveCart(lines: CartLine[], products: ProductMap): ResolvedCart {
  const resolved = lines.map((line) => {
    const product = products[line.productId] ?? null
    const available = Boolean(product?.is_available)
    return {
      line,
      product,
      available,
      lineTotalCents: available && product ? product.price_cents * line.quantity : 0,
    }
  })

  const availableLines = resolved.filter((r) => r.available && r.product)
  return {
    lines: resolved,
    itemCount: availableLines.reduce((n, r) => n + r.line.quantity, 0),
    subtotalCents: subtotal(
      availableLines.map((r) => ({ unitPriceCents: r.product!.price_cents, quantity: r.line.quantity })),
    ),
    hasUnavailable: resolved.some((r) => !r.available),
  }
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.trunc(quantity)))
}
