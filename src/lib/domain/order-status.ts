import type { FulfillmentType, OrderStatus } from '@/lib/supabase/database.types'

// Espelho do trigger validate_order_status_transition (migration 0002).
// O banco é quem garante a regra; aqui é só para a UI mostrar os botões certos.

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Recebido',
  confirmed: 'Confirmado',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

export const FINAL_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled']

/** Sequência "feliz" de cada tipo de recebimento (sem o cancelado). */
export function statusFlow(fulfillment: FulfillmentType): OrderStatus[] {
  return fulfillment === 'delivery'
    ? ['received', 'confirmed', 'out_for_delivery', 'completed']
    : ['received', 'confirmed', 'ready_for_pickup', 'completed']
}

/** Próximo status da sequência, ou null se já terminou. */
export function nextStatus(current: OrderStatus, fulfillment: FulfillmentType): OrderStatus | null {
  if (FINAL_STATUSES.includes(current)) return null
  const flow = statusFlow(fulfillment)
  const i = flow.indexOf(current)
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: FulfillmentType,
): boolean {
  if (from === to) return false
  if (FINAL_STATUSES.includes(from)) return false
  if (to === 'cancelled') return true
  return nextStatus(from, fulfillment) === to
}
