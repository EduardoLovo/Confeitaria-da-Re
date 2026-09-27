import 'server-only'

import type { OrderStatus, Tables } from '@/lib/supabase/database.types'
import { createServiceClient } from '@/lib/supabase/admin'
import { waLink } from '@/lib/whatsapp/wa-link'
import { buildCustomerMessage } from './message'

export type NotifiableOrder = Pick<
  Tables<'orders'>,
  'id' | 'number' | 'customer_name' | 'customer_phone' | 'total_cents' | 'fulfillment'
>

/**
 * Resultado de uma notificação.
 * - Fase 1: `wa_link` → o painel abre o WhatsApp com a mensagem pronta (envio manual).
 * - Fase 3: `sent` → a mensagem foi enviada pela WhatsApp Cloud API (automático).
 */
export type NotificationResult =
  | { channel: 'wa_link'; url: string; message: string }
  | { channel: 'whatsapp_api'; sent: true; message: string }

/**
 * PONTO ÚNICO de notificação da cliente sobre o pedido.
 *
 * Hoje só gera o link wa.me com o texto do status. Na Fase 3, troque o
 * final desta função por uma chamada à WhatsApp Cloud API e devolva
 * `{ channel: 'whatsapp_api', sent: true }` — quem chama já trata os dois casos.
 *
 * Só deve ser chamada por uma ação explícita (clique em "Avisar cliente"),
 * nunca ao renderizar uma página, para que na Fase 3 não haja envios duplicados.
 */
export async function notifyCustomer(order: NotifiableOrder, status: OrderStatus): Promise<NotificationResult> {
  const supabase = createServiceClient()
  const [template, store] = await Promise.all([
    supabase.from('whatsapp_templates').select('body').eq('status', status).maybeSingle(),
    supabase.from('store_settings').select('name, pickup_address').single(),
  ])
  if (store.error) throw new Error(`store_settings: ${store.error.message}`)

  const message = buildCustomerMessage({
    order,
    status,
    template: template.data?.body,
    store: store.data,
  })

  return { channel: 'wa_link', url: waLink(order.customer_phone, message), message }
}
