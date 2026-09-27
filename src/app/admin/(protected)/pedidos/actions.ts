'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { adminAction, dbFailed, type ActionResult } from '@/lib/admin/action-result'
import { requireAdminAction } from '@/lib/auth'
import { canTransition, STATUS_LABEL } from '@/lib/domain/order-status'
import { notifyCustomer, type NotificationResult } from '@/lib/notifications/notify-customer'
import type { OrderStatus } from '@/lib/supabase/database.types'

const statusSchema = z.enum([
  'received',
  'confirmed',
  'out_for_delivery',
  'ready_for_pickup',
  'completed',
  'cancelled',
])

/** "Avisar cliente": notifica a cliente sobre o status ATUAL do pedido. */
export async function notifyCustomerAction(orderId: string): Promise<ActionResult<NotificationResult>> {
  return adminAction<NotificationResult>(async () => {
    const id = z.uuid().parse(orderId)
    const session = await requireAdminAction()
    const { data: order, error } = await session.supabase
      .from('orders')
      .select('id, number, customer_name, customer_phone, total_cents, fulfillment, status')
      .eq('id', id)
      .single()
    if (error) return dbFailed(error, 'ler pedido para notificar')

    const result = await notifyCustomer(order, order.status)
    return { ok: true, data: result }
  })
}

/** Avança/cancela o pedido. O trigger do banco também valida a transição. */
export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
): Promise<ActionResult<{ status: OrderStatus }>> {
  return adminAction<{ status: OrderStatus }>(async () => {
    const id = z.uuid().parse(orderId)
    const target = statusSchema.parse(to)
    const session = await requireAdminAction()

    const { data: order, error: readError } = await session.supabase
      .from('orders')
      .select('status, fulfillment')
      .eq('id', id)
      .single()
    if (readError) return dbFailed(readError, 'ler pedido')

    if (!canTransition(order.status, target, order.fulfillment)) {
      return { ok: false, message: 'Essa mudança de status não é permitida.' }
    }

    const { error } = await session.supabase.from('orders').update({ status: target }).eq('id', id)
    if (error) return dbFailed(error, 'mudar status')

    revalidatePath('/admin/pedidos')
    revalidatePath(`/admin/pedidos/${id}`)
    return { ok: true, message: `Pedido: ${STATUS_LABEL[target]}`, data: { status: target } }
  })
}
