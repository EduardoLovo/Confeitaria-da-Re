import type { OrderStatus, PaymentStatus } from '@/lib/supabase/database.types'

/** Campos da linha que chegam pelo Realtime (payload.new). */
export type RealtimeOrderRow = {
  id: string
  number: number
  customer_name: string
  total_cents: number
  status: OrderStatus
  payment_status: PaymentStatus
  paid_at: string | null
}

export type OrderAlert = 'new_order' | 'paid_after_cancel' | null

/** Janela para considerar um pagamento "acabou de acontecer". */
const RECENT_PAYMENT_MS = 2 * 60_000

/**
 * Decide se um evento do Realtime deve tocar o alerta de pedido novo.
 *
 * - INSERT: alerta, exceto pedido online ainda sem pagamento (awaiting_payment),
 *   que só vira "novo" para a loja quando for pago.
 * - UPDATE: alerta quando o pagamento online acabou de ser confirmado
 *   (status 'received' pago há pouco) ou chegou depois do cancelamento.
 *   O Realtime não manda a linha antiga, então usamos paid_at recente; quem
 *   chama deve ignorar ids já alertados (outras mudanças do mesmo pedido).
 */
export function orderAlertFor(
  event: 'INSERT' | 'UPDATE',
  row: RealtimeOrderRow,
  now: number = Date.now(),
): OrderAlert {
  if (event === 'INSERT') return row.status === 'awaiting_payment' ? null : 'new_order'

  const justPaid =
    row.payment_status === 'paid' && row.paid_at !== null && now - new Date(row.paid_at).getTime() < RECENT_PAYMENT_MS
  if (!justPaid) return null
  if (row.status === 'received') return 'new_order'
  if (row.status === 'cancelled') return 'paid_after_cancel'
  return null
}
