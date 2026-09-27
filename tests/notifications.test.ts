import { describe, expect, it } from 'vitest'

import { buildCustomerMessage, DEFAULT_TEMPLATES, renderTemplate } from '@/lib/notifications/message'

const order = { number: 123, customer_name: 'Maria da Silva', total_cents: 5800, fulfillment: 'pickup' as const }
const store = { name: 'Confeitaria da Re', pickup_address: 'Rua das Flores, 123' }
const trackingUrl = 'https://loja.com.br/pedido/abc'

describe('renderTemplate', () => {
  it('troca placeholders conhecidos e mantém os desconhecidos', () => {
    expect(renderTemplate('Oi {nome}, {x}!', { nome: 'Ana' })).toBe('Oi Ana, {x}!')
  })
})

describe('buildCustomerMessage', () => {
  it('usa o template da loja com primeiro nome, número, total e endereço', () => {
    const msg = buildCustomerMessage({
      order,
      status: 'ready_for_pickup',
      template: 'Oi {nome}! #{numero} ({total}) pronto em {endereco_retirada} — {loja} {link}',
      store,
      trackingUrl,
    })
    expect(msg).toBe('Oi Maria! #123 (R$ 58,00) pronto em Rua das Flores, 123 — Confeitaria da Re https://loja.com.br/pedido/abc')
  })

  it('cai no texto padrão quando o template está vazio', () => {
    const msg = buildCustomerMessage({ order, status: 'cancelled', template: '  ', store, trackingUrl })
    expect(msg).toBe(renderTemplate(DEFAULT_TEMPLATES.cancelled, { nome: 'Maria', numero: '123' }))
  })

  it('tem texto padrão para todos os status', () => {
    for (const status of Object.keys(DEFAULT_TEMPLATES) as (keyof typeof DEFAULT_TEMPLATES)[]) {
      expect(buildCustomerMessage({ order, status, template: null, store, trackingUrl })).toContain('#123')
    }
  })
})
