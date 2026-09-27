import { describe, expect, it } from 'vitest'

import { canTransition, nextStatus } from '@/lib/domain/order-status'

describe('fluxo de status', () => {
  it('entrega segue recebido → confirmado → saiu → concluído', () => {
    expect(nextStatus('received', 'delivery')).toBe('confirmed')
    expect(nextStatus('confirmed', 'delivery')).toBe('out_for_delivery')
    expect(nextStatus('out_for_delivery', 'delivery')).toBe('completed')
    expect(nextStatus('completed', 'delivery')).toBeNull()
  })

  it('retirada usa "pronto para retirada"', () => {
    expect(nextStatus('confirmed', 'pickup')).toBe('ready_for_pickup')
    expect(canTransition('confirmed', 'out_for_delivery', 'pickup')).toBe(false)
    expect(canTransition('confirmed', 'ready_for_pickup', 'delivery')).toBe(false)
  })

  it('cancelar é possível antes de concluir', () => {
    expect(canTransition('received', 'cancelled', 'delivery')).toBe(true)
    expect(canTransition('ready_for_pickup', 'cancelled', 'pickup')).toBe(true)
    expect(canTransition('completed', 'cancelled', 'pickup')).toBe(false)
    expect(canTransition('cancelled', 'received', 'pickup')).toBe(false)
  })

  it('não pula etapas', () => {
    expect(canTransition('received', 'completed', 'delivery')).toBe(false)
  })
})
