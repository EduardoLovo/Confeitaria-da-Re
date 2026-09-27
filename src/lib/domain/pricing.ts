// Cálculo exibido no navegador (carrinho e resumo do checkout).
// O valor que vale é sempre o recalculado no servidor por create_order().

export type PricedLine = { unitPriceCents: number; quantity: number }

export function lineTotal(line: PricedLine): number {
  return line.unitPriceCents * line.quantity
}

export function subtotal(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0)
}

export function orderTotals(lines: PricedLine[], deliveryFeeCents: number) {
  const sub = subtotal(lines)
  return { subtotalCents: sub, deliveryFeeCents, totalCents: sub + deliveryFeeCents }
}

/** Quanto falta para atingir o pedido mínimo (0 se já atingiu). */
export function missingForMinimum(subtotalCents: number, minOrderCents: number): number {
  return Math.max(0, minOrderCents - subtotalCents)
}
