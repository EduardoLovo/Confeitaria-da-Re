import { beforeEach, describe, expect, it } from 'vitest'

import { buildCustomerMessage, DEFAULT_TEMPLATES } from '@/lib/notifications/message'
import { ordersToTrack, SHOW_FOR_MS, useRecentOrders, type RecentOrder } from '@/stores/recent-orders'

const NOW = new Date('2026-09-27T15:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const HOUR = 60 * 60 * 1000

const order = (n: number, overrides: Partial<RecentOrder> = {}): RecentOrder => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  number: 100 + n,
  createdAt: ago(n * HOUR),
  status: 'received',
  ...overrides,
})

describe('ordersToTrack', () => {
  it('mostra só pedidos recentes e ainda em andamento, no máximo 3', () => {
    const list = [
      order(1),
      order(2, { status: 'completed' }),
      order(3, { status: 'out_for_delivery' }),
      order(4, { status: 'cancelled' }),
      order(5),
      order(6),
    ]
    expect(ordersToTrack(list, NOW).map((o) => o.number)).toEqual([101, 103, 105])
  })

  it('esconde pedidos mais antigos que o prazo', () => {
    expect(ordersToTrack([order(1, { createdAt: ago(SHOW_FOR_MS + HOUR) })], NOW)).toEqual([])
  })
})

describe('useRecentOrders.remember', () => {
  beforeEach(() => useRecentOrders.setState({ orders: [] }))

  it('atualiza o mesmo pedido em vez de duplicar e mantém o mais novo primeiro', () => {
    const { remember } = useRecentOrders.getState()
    remember(order(2))
    remember(order(1))
    remember(order(2, { status: 'confirmed' }))
    const orders = useRecentOrders.getState().orders
    expect(orders.map((o) => o.number)).toEqual([101, 102])
    expect(orders[1].status).toBe('confirmed')
  })

  it('guarda no máximo 10 pedidos', () => {
    const { remember } = useRecentOrders.getState()
    for (let i = 1; i <= 12; i++) remember(order(i))
    expect(useRecentOrders.getState().orders).toHaveLength(10)
  })
})

describe('link de acompanhamento nas mensagens padrão', () => {
  it('só os status em andamento levam o link', () => {
    const withLink = (Object.keys(DEFAULT_TEMPLATES) as (keyof typeof DEFAULT_TEMPLATES)[]).filter((s) =>
      buildCustomerMessage({
        order: { number: 1, customer_name: 'Ana', total_cents: 100, fulfillment: 'pickup' },
        status: s,
        template: null,
        store: { name: 'Loja', pickup_address: null },
        trackingUrl: 'https://x/pedido/1',
      }).includes('https://x/pedido/1'),
    )
    expect(withLink).toEqual(['received', 'confirmed', 'out_for_delivery', 'ready_for_pickup'])
  })
})
