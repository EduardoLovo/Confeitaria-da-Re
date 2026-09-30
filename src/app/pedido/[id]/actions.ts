'use server'

import { z } from 'zod'

import { ensurePaymentLink } from '@/lib/payments/online-payment'
import { createServiceClient } from '@/lib/supabase/admin'

export type StartPaymentResult = { ok: true; url: string } | { ok: false; message: string }

/** "Pagar agora": devolve (ou cria) o link do checkout da InfinitePay. */
export async function startPayment(orderId: string): Promise<StartPaymentResult> {
  try {
    const link = await ensurePaymentLink(orderId)
    if (link.ok) return link
    const messages = {
      not_found: 'Pedido não encontrado.',
      not_awaiting_payment: 'Este pedido não está aguardando pagamento.',
      expired: 'O prazo para pagar este pedido terminou. Faça um novo pedido, por favor.',
    } as const
    return { ok: false, message: messages[link.reason] }
  } catch (err) {
    console.error('[startPayment]', { orderId }, err)
    return {
      ok: false,
      message: 'Não conseguimos abrir o pagamento agora. Tente de novo em instantes ou fale com a gente no WhatsApp.',
    }
  }
}

/** Marca que a cliente quer acompanhar o pedido pelo WhatsApp. */
export async function markWantsWhatsappUpdates(orderId: string): Promise<void> {
  const parsed = z.uuid().safeParse(orderId)
  if (!parsed.success) return

  const { error } = await createServiceClient()
    .from('orders')
    .update({ wants_whatsapp_updates: true })
    .eq('id', parsed.data)

  if (error) console.error('[markWantsWhatsappUpdates]', error)
}
