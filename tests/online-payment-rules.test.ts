import { describe, expect, it } from 'vitest'

import { orderAlertFor, type RealtimeOrderRow } from '@/lib/admin/order-alert'
import { canTransition, nextStatus } from '@/lib/domain/order-status'
import { paymentMethodsFor } from '@/lib/domain/payment'
import { checkoutSchema } from '@/lib/validation/order'

const NOW = Date.parse('2026-09-30T15:00:00Z')
const row = (over: Partial<RealtimeOrderRow> = {}): RealtimeOrderRow => ({
  id: 'a',
  number: 101,
  customer_name: 'Ana',
  total_cents: 4000,
  status: 'received',
  payment_status: 'pending',
  paid_at: null,
  ...over,
})

describe('formas de pagamento por recebimento', () => {
  it('entrega só online; retirada online ou na hora', () => {
    expect(paymentMethodsFor('delivery')).toEqual(['online'])
    expect(paymentMethodsFor('pickup')).toEqual(['online', 'pix_on_delivery', 'card_on_delivery'])
  })

  const base = {
    customerName: 'Ana Souza',
    customerPhone: '(11) 98765-4321',
    items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 1 }],
  }
  const address = { neighborhood: 'Centro', street: 'Rua A', streetNumber: '10' }

  it('checkout recusa entrega com pagamento na entrega', () => {
    const r = checkoutSchema.safeParse({ ...base, ...address, fulfillment: 'delivery', paymentMethod: 'pix_on_delivery' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(['paymentMethod'])
  })

  it('checkout aceita entrega online e retirada com qualquer forma aceita', () => {
    expect(checkoutSchema.safeParse({ ...base, ...address, fulfillment: 'delivery', paymentMethod: 'online' }).success).toBe(true)
    for (const paymentMethod of ['online', 'pix_on_delivery', 'card_on_delivery']) {
      expect(checkoutSchema.safeParse({ ...base, fulfillment: 'pickup', paymentMethod }).success).toBe(true)
    }
    expect(checkoutSchema.safeParse({ ...base, fulfillment: 'pickup', paymentMethod: 'cash' }).success).toBe(false)
  })
})

describe('status aguardando pagamento no painel', () => {
  it('não tem "próximo passo"; só pode ser cancelado', () => {
    expect(nextStatus('awaiting_payment', 'delivery')).toBeNull()
    expect(canTransition('awaiting_payment', 'cancelled', 'delivery')).toBe(true)
    expect(canTransition('awaiting_payment', 'received', 'delivery')).toBe(false)
    expect(canTransition('awaiting_payment', 'confirmed', 'pickup')).toBe(false)
  })
})

describe('alerta de pedido novo (Realtime)', () => {
  it('INSERT: alerta, exceto pedido aguardando pagamento', () => {
    expect(orderAlertFor('INSERT', row(), NOW)).toBe('new_order')
    expect(orderAlertFor('INSERT', row({ status: 'awaiting_payment' }), NOW)).toBeNull()
  })

  it('UPDATE: alerta quando acabou de ser pago', () => {
    const paidAt = new Date(NOW - 10_000).toISOString()
    expect(orderAlertFor('UPDATE', row({ payment_status: 'paid', paid_at: paidAt }), NOW)).toBe('new_order')
    expect(orderAlertFor('UPDATE', row({ status: 'cancelled', payment_status: 'paid', paid_at: paidAt }), NOW)).toBe(
      'paid_after_cancel',
    )
  })

  it('UPDATE: não alerta mudanças comuns nem pagamento antigo', () => {
    expect(orderAlertFor('UPDATE', row(), NOW)).toBeNull()
    expect(orderAlertFor('UPDATE', row({ status: 'cancelled' }), NOW)).toBeNull()
    const old = new Date(NOW - 10 * 60_000).toISOString()
    expect(orderAlertFor('UPDATE', row({ payment_status: 'paid', paid_at: old }), NOW)).toBeNull()
    const recent = new Date(NOW - 10_000).toISOString()
    expect(orderAlertFor('UPDATE', row({ status: 'confirmed', payment_status: 'paid', paid_at: recent }), NOW)).toBeNull()
  })
})
