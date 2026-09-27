import { describe, expect, it } from 'vitest'

import { waLink } from '@/lib/whatsapp/wa-link'
import { checkoutSchema, fieldErrors, toCreateOrderPayload } from '@/lib/validation/order'

const PRODUCT = '00000000-0000-4000-8000-00000000000a'
const ZONE = '00000000-0000-4000-8000-0000000000b0'

const base = {
  customerName: '  Maria  ',
  customerPhone: '(11) 98765-4321',
  paymentMethod: 'pix_on_delivery',
  items: [{ productId: PRODUCT, quantity: 2, note: '' }],
}

describe('checkoutSchema', () => {
  it('aceita retirada e normaliza nome/telefone', () => {
    const r = checkoutSchema.parse({ ...base, fulfillment: 'pickup' })
    expect(r.customerName).toBe('Maria')
    expect(r.customerPhone).toBe('11987654321')
    expect(r.items[0].note).toBeUndefined()
  })

  it('exige bairro, rua e número na entrega', () => {
    const r = checkoutSchema.safeParse({ ...base, fulfillment: 'delivery', street: '', streetNumber: '' })
    expect(r.success).toBe(false)
    const errors = fieldErrors(r.error!)
    expect(errors.deliveryZoneId).toBe('Escolha o bairro')
    expect(errors.street).toBe('Informe a rua')
    expect(errors.streetNumber).toBe('Informe o número')
  })

  it('pede para escolher entrega ou retirada', () => {
    const r = checkoutSchema.safeParse({ ...base, fulfillment: '' })
    expect(fieldErrors(r.error!).fulfillment).toBe('Escolha entrega ou retirada')
  })

  it('rejeita telefone sem DDD e CEP incompleto', () => {
    const r = checkoutSchema.safeParse({
      ...base,
      customerPhone: '98765-4321',
      fulfillment: 'delivery',
      deliveryZoneId: ZONE,
      cep: '0131',
      street: 'Rua A',
      streetNumber: '1',
    })
    const errors = fieldErrors(r.error!)
    expect(errors.customerPhone).toMatch(/DDD/)
    expect(errors.cep).toBe('CEP deve ter 8 dígitos')
  })

  it('carrinho vazio e quantidade fora do limite', () => {
    expect(fieldErrors(checkoutSchema.safeParse({ ...base, fulfillment: 'pickup', items: [] }).error!).items).toBe(
      'Seu carrinho está vazio',
    )
    expect(
      checkoutSchema.safeParse({ ...base, fulfillment: 'pickup', items: [{ productId: PRODUCT, quantity: 100 }] })
        .success,
    ).toBe(false)
  })
})

describe('toCreateOrderPayload', () => {
  it('monta o payload de entrega e descarta troco fora do dinheiro', () => {
    const data = checkoutSchema.parse({
      ...base,
      fulfillment: 'delivery',
      changeForCents: 5000,
      deliveryZoneId: ZONE,
      cep: '01310-100',
      street: 'Av. Paulista',
      streetNumber: '1000',
    })
    const payload = toCreateOrderPayload(data, 'hash')
    expect(payload).toMatchObject({
      fulfillment: 'delivery',
      delivery_zone_id: ZONE,
      cep: '01310100',
      change_for_cents: null,
      ip_hash: 'hash',
      items: [{ product_id: PRODUCT, quantity: 2, note: null }],
    })
    // O front nunca manda preço.
    expect(JSON.stringify(payload)).not.toMatch(/price|total|subtotal|fee/)
  })

  it('retirada não leva endereço', () => {
    const payload = toCreateOrderPayload(
      checkoutSchema.parse({ ...base, fulfillment: 'pickup', paymentMethod: 'cash', changeForCents: 10000 }),
      null,
    )
    expect(payload).not.toHaveProperty('street')
    expect(payload.change_for_cents).toBe(10000)
  })
})

describe('waLink', () => {
  it('adiciona 55 e codifica a mensagem', () => {
    expect(waLink('(11) 98765-4321', 'Olá! Quero acompanhar meu pedido #123')).toBe(
      'https://wa.me/5511987654321?text=Ol%C3%A1!%20Quero%20acompanhar%20meu%20pedido%20%23123',
    )
    expect(waLink('5511999999999')).toBe('https://wa.me/5511999999999')
  })
})
