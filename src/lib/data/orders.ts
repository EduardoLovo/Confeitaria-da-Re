import 'server-only'

import { z } from 'zod'

import type { Tables } from '@/lib/supabase/database.types'
import { createServiceClient } from '@/lib/supabase/admin'

/** Campos do pedido que a própria cliente pode ver na página de confirmação. */
export type PublicOrder = Pick<
  Tables<'orders'>,
  | 'id'
  | 'number'
  | 'customer_name'
  | 'fulfillment'
  | 'zone_name_snapshot'
  | 'street'
  | 'street_number'
  | 'complement'
  | 'subtotal_cents'
  | 'delivery_fee_cents'
  | 'total_cents'
  | 'payment_method'
  | 'change_for_cents'
  | 'notes'
  | 'status'
  | 'wants_whatsapp_updates'
  | 'created_at'
  | 'payment_status'
  | 'payment_expires_at'
  | 'payment_capture_method'
  | 'payment_receipt_url'
> & {
  items: Pick<Tables<'order_items'>, 'id' | 'name_snapshot' | 'quantity' | 'line_total_cents' | 'note'>[]
}

/**
 * Busca um pedido pelo UUID (o UUID funciona como "senha" do link).
 * Usa a service_role porque pedidos nunca são legíveis pelo público via RLS;
 * por isso seleciona só os campos seguros de exibir.
 */
export async function getPublicOrder(id: string): Promise<PublicOrder | null> {
  if (!z.uuid().safeParse(id).success) return null

  const { data, error } = await createServiceClient()
    .from('orders')
    .select(
      `id, number, customer_name, fulfillment, zone_name_snapshot, street, street_number, complement,
       subtotal_cents, delivery_fee_cents, total_cents, payment_method, change_for_cents, notes,
       status, wants_whatsapp_updates, created_at,
       payment_status, payment_expires_at, payment_capture_method, payment_receipt_url,
       items:order_items (id, name_snapshot, quantity, line_total_cents, note)`,
    )
    .eq('id', id)
    .order('sort_order', { referencedTable: 'order_items' })
    .maybeSingle()

  if (error) throw new Error(`pedido: ${error.message}`)
  return data
}
