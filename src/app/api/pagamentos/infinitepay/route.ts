import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { confirmOnlinePayment } from '@/lib/payments/online-payment'

/**
 * Webhook da InfinitePay: chamado quando um pagamento é aprovado.
 *
 * Como a InfinitePay não assina o aviso, o corpo serve só para saber QUAL
 * pagamento conferir: confirmOnlinePayment() consulta a InfinitePay
 * (payment_check) antes de marcar o pedido como pago.
 *
 * Resposta: 200 = processado (ou ignorável); 400 = a InfinitePay tenta de novo.
 * Reprocessar é seguro: a confirmação é idempotente.
 */

const webhookSchema = z.object({
  order_nsu: z.uuid(),
  transaction_nsu: z.string().min(1).max(200),
  invoice_slug: z.string().min(1).max(200),
  receipt_url: z.url().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 200 })
  }

  const parsed = webhookSchema.safeParse(body)
  if (!parsed.success) {
    // Não é um pedido deste site (ou formato inesperado): tentar de novo não resolve.
    console.warn('[webhook infinitepay] aviso ignorado', { body })
    return NextResponse.json({ ok: false, error: 'ignored' }, { status: 200 })
  }

  try {
    const result = await confirmOnlinePayment({
      orderId: parsed.data.order_nsu,
      transactionNsu: parsed.data.transaction_nsu,
      slug: parsed.data.invoice_slug,
      receiptUrl: parsed.data.receipt_url,
    })
    if (result === 'not_paid') {
      // A InfinitePay avisou mas ainda não confirma: pede para reenviar mais tarde.
      return NextResponse.json({ ok: false, result }, { status: 400 })
    }
    return NextResponse.json({ ok: true, result }, { status: 200 })
  } catch (err) {
    console.error('[webhook infinitepay] falha ao confirmar', { orderId: parsed.data.order_nsu }, err)
    return NextResponse.json({ ok: false, error: 'retry' }, { status: 400 })
  }
}
