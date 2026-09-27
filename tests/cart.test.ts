import { beforeEach, describe, expect, it } from 'vitest'

import { clampQuantity, resolveCart, type CartLine } from '@/lib/domain/cart'
import type { ProductMap } from '@/lib/domain/catalog'
import { useCart } from '@/stores/cart'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const GONE = '00000000-0000-4000-8000-00000000000c'

const products: ProductMap = {
  [A]: { id: A, name: 'Brigadeiro', description: null, price_cents: 450, image_path: null, is_available: true },
  [B]: { id: B, name: 'Beijinho', description: null, price_cents: 400, image_path: null, is_available: false },
}

const line = (productId: string, quantity: number, note = ''): CartLine => ({
  id: `${productId}-${note}`,
  productId,
  quantity,
  note,
})

describe('resolveCart', () => {
  it('usa o preço do catálogo e soma só os disponíveis', () => {
    const cart = resolveCart([line(A, 3), line(B, 2)], products)
    expect(cart.subtotalCents).toBe(1350)
    expect(cart.itemCount).toBe(3)
    expect(cart.hasUnavailable).toBe(true)
  })

  it('marca item removido do cardápio como indisponível', () => {
    const cart = resolveCart([line(GONE, 1)], products)
    expect(cart.lines[0].product).toBeNull()
    expect(cart.lines[0].available).toBe(false)
    expect(cart.subtotalCents).toBe(0)
  })
})

describe('clampQuantity', () => {
  it('mantém entre 1 e 99', () => {
    expect(clampQuantity(0)).toBe(1)
    expect(clampQuantity(150)).toBe(99)
    expect(clampQuantity(2.7)).toBe(2)
    expect(clampQuantity(Number.NaN)).toBe(1)
  })
})

describe('store do carrinho', () => {
  beforeEach(() => useCart.getState().clear())

  it('junta o mesmo produto com a mesma observação', () => {
    const { add } = useCart.getState()
    add(A, 2, 'sem granulado')
    add(A, 3, '  sem granulado ')
    add(A, 1)
    const lines = useCart.getState().lines
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ quantity: 5, note: 'sem granulado' })
  })

  it('altera quantidade e remove', () => {
    const { add } = useCart.getState()
    add(A, 1)
    const id = useCart.getState().lines[0].id
    useCart.getState().setQuantity(id, 120)
    expect(useCart.getState().lines[0].quantity).toBe(99)
    useCart.getState().remove(id)
    expect(useCart.getState().lines).toHaveLength(0)
  })
})
