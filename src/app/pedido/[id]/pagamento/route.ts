import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { confirmOnlinePayment } from '@/lib/payments/online-payment'

/**
 * Volta do checkout da InfinitePay (redirect_url). A InfinitePay acrescenta
 * receipt_url, order_nsu, slug, capture_method e transaction_nsu.
 *
 * Confere o pagamento (rede de segurança caso o webhook atrase ou se perca)
 * e leva a cliente para a página do pedido. Qualquer falha aqui só é
 * registrada: o webhook continua podendo confirmar depois.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/pedido/[id]/pagamento'>) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return NextResponse.redirect(new URL('/', request.url))

  const orderUrl = new URL(`/pedido/${id}`, request.url)
  const q = request.nextUrl.searchParams
  const transactionNsu = q.get('transaction_nsu')
  const slug = q.get('slug')
  const orderNsu = q.get('order_nsu')

  if (transactionNsu && slug && (!orderNsu || orderNsu === id)) {
    try {
      const result = await confirmOnlinePayment({
        orderId: id,
        transactionNsu,
        slug,
        receiptUrl: q.get('receipt_url'),
      })
      if (result === 'not_paid') orderUrl.searchParams.set('pagamento', 'pendente')
    } catch (err) {
      console.error('[retorno infinitepay] falha ao conferir pagamento', { orderId: id }, err)
    }
  }

  // 303: a página do pedido é sempre aberta com GET, sem os parâmetros da InfinitePay.
  return NextResponse.redirect(orderUrl, 303)
}
