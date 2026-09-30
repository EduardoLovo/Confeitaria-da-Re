import 'server-only'

import { after } from 'next/server'
import { z } from 'zod'

import { notifyOwnerNewOrder } from '@/lib/notifications/notify-owner'
import { getSiteUrl, orderTrackingUrl } from '@/lib/site-url'
import { createServiceClient } from '@/lib/supabase/admin'
import { checkPayment, createCheckoutLink } from './infinitepay'

/** Para onde a InfinitePay manda a cliente depois de pagar (confere e mostra o pedido). */
export function paymentReturnUrl(orderId: string): string {
  return `${orderTrackingUrl(orderId)}/pagamento`
}

/** Onde a InfinitePay avisa que um pagamento foi aprovado. */
export function paymentWebhookUrl(): string {
  return `${getSiteUrl()}/api/pagamentos/infinitepay`
}

// -------------------------------------------------------------
// Link de pagamento
// -------------------------------------------------------------

export type PaymentLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'not_found' | 'not_awaiting_payment' | 'expired' }

/**
 * Devolve o link de pagamento do pedido, criando na InfinitePay se ainda não
 * existir. Só para pedidos online aguardando pagamento e dentro do prazo.
 * Lança erro se a InfinitePay falhar (quem chama decide o que mostrar).
 */
export async function ensurePaymentLink(orderId: string): Promise<PaymentLinkResult> {
  if (!z.uuid().safeParse(orderId).success) return { ok: false, reason: 'not_found' }

  const supabase = createServiceClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `id, number, status, payment_url, payment_expires_at, customer_name, customer_phone,
       fulfillment, delivery_fee_cents, cep, street, street_number, complement, zone_name_snapshot,
       items:order_items (name_snapshot, quantity, unit_price_cents, sort_order)`,
    )
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw new Error(`pedido: ${error.message}`)
  if (!order) return { ok: false, reason: 'not_found' }
  if (order.status !== 'awaiting_payment') return { ok: false, reason: 'not_awaiting_payment' }
  if (order.payment_expires_at && new Date(order.payment_expires_at) <= new Date()) {
    return { ok: false, reason: 'expired' }
  }
  if (order.payment_url) return { ok: true, url: order.payment_url }

  const items = [...order.items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({ description: item.name_snapshot, quantity: item.quantity, priceCents: item.unit_price_cents }))
  if (order.delivery_fee_cents > 0) {
    items.push({ description: 'Taxa de entrega', quantity: 1, priceCents: order.delivery_fee_cents })
  }

  const url = await createCheckoutLink({
    orderNsu: order.id,
    items,
    redirectUrl: paymentReturnUrl(order.id),
    webhookUrl: paymentWebhookUrl(),
    customer: { name: order.customer_name, phoneNumber: `+55${order.customer_phone}` },
    address:
      order.fulfillment === 'delivery'
        ? {
            cep: order.cep ?? undefined,
            street: order.street ?? undefined,
            neighborhood: order.zone_name_snapshot ?? undefined,
            number: order.street_number ?? undefined,
            complement: order.complement ?? undefined,
          }
        : undefined,
  })

  // Só grava se ninguém gravou antes (duas abas clicando "Pagar" juntas).
  const { data: saved, error: saveError } = await supabase
    .from('orders')
    .update({ payment_url: url })
    .eq('id', order.id)
    .is('payment_url', null)
    .select('payment_url')
    .maybeSingle()
  if (saveError) throw new Error(`salvar link: ${saveError.message}`)
  if (saved?.payment_url) return { ok: true, url: saved.payment_url }

  const { data: current } = await supabase.from('orders').select('payment_url').eq('id', order.id).single()
  return { ok: true, url: current?.payment_url ?? url }
}

// -------------------------------------------------------------
// Confirmação de pagamento
// -------------------------------------------------------------

export type ConfirmResult =
  | 'confirmed' // pagou agora: pedido entrou na fila da loja
  | 'already_paid' // já estava registrado
  | 'paid_after_cancel' // pagou depois de expirar/cancelar: a loja decide
  | 'not_paid' // a InfinitePay diz que (ainda) não foi pago
  | 'amount_mismatch' // pago com valor menor que o pedido: não aceito

const confirmRpcSchema = z.object({
  result: z.enum(['confirmed', 'already_paid', 'paid_after_cancel']),
  number: z.number().int(),
})

/**
 * Confere o pagamento NA InfinitePay e, se pago, registra no banco.
 * Idempotente: webhook e volta do checkout podem chamar para o mesmo pagamento.
 * A loja é avisada (WhatsApp) uma única vez, quando o banco devolve
 * 'confirmed' ou 'paid_after_cancel'.
 */
export async function confirmOnlinePayment(input: {
  orderId: string
  transactionNsu: string
  slug: string
  receiptUrl?: string | null
}): Promise<ConfirmResult> {
  const check = await checkPayment({
    orderNsu: input.orderId,
    transactionNsu: input.transactionNsu,
    slug: input.slug,
  })
  if (!check.success || !check.paid) return 'not_paid'

  const supabase = createServiceClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('total_cents')
    .eq('id', input.orderId)
    .maybeSingle()
  if (orderError) throw new Error(`pedido: ${orderError.message}`)
  if (!order) throw new Error(`pedido ${input.orderId} não existe`)

  // amount = valor do link; paid_amount = o que a cliente pagou (com juros, se parcelou).
  const amount = check.amount ?? check.paid_amount
  if (amount === undefined || amount < order.total_cents) {
    console.error('[confirmOnlinePayment] valor pago menor que o pedido', {
      orderId: input.orderId,
      total: order.total_cents,
      check,
    })
    return 'amount_mismatch'
  }

  const { data, error } = await supabase.rpc('confirm_order_payment', {
    p_order_id: input.orderId,
    p_transaction_nsu: input.transactionNsu,
    p_paid_amount_cents: check.paid_amount ?? amount,
    p_capture_method: check.capture_method ?? null,
    p_receipt_url: safeReceiptUrl(input.receiptUrl),
  })
  if (error) throw new Error(`confirm_order_payment: ${error.message}`)

  const { result } = confirmRpcSchema.parse(data)
  if (result === 'confirmed') after(() => notifyOwnerNewOrder(input.orderId))
  if (result === 'paid_after_cancel') after(() => notifyOwnerNewOrder(input.orderId, { paidAfterCancel: true }))
  return result
}

/** O comprovante vem de fora (webhook/URL) e vira link na tela: só https. */
function safeReceiptUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 500) return null
  try {
    return new URL(value).protocol === 'https:' ? value : null
  } catch {
    return null
  }
}
