'use server'

import { after } from 'next/server'
import { z } from 'zod'

import { notifyOwnerNewOrder } from '@/lib/notifications/notify-owner'
import { ensurePaymentLink } from '@/lib/payments/online-payment'
import { requestIpHash } from '@/lib/security/ip-hash'
import { createServiceClient } from '@/lib/supabase/admin'
import { checkoutSchema, fieldErrors, toCreateOrderPayload } from '@/lib/validation/order'

export type CreateOrderResult =
  | {
      ok: true
      orderId: string
      orderNumber: number
      /**
       * Pedido online: link do checkout da InfinitePay para onde a cliente vai.
       * null se o link não pôde ser criado agora; a página do pedido tenta de novo.
       */
      paymentUrl: string | null
    }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string>
      /** Produtos que esgotaram/saíram do cardápio: a página recarrega o catálogo. */
      unavailableProductIds?: string[]
      /** O front deve recarregar os dados do servidor (catálogo, frete, loja). */
      refresh?: boolean
    }

const rpcResultSchema = z.object({ id: z.uuid(), number: z.number().int(), requires_payment: z.boolean() })

const FRIENDLY_ERRORS: Record<string, { message: string; refresh?: boolean }> = {
  STORE_CLOSED: {
    message: 'A loja acabou de fechar e não está recebendo pedidos agora. 😔',
    refresh: true,
  },
  RATE_LIMITED: {
    message:
      'Recebemos vários pedidos seguidos deste aparelho. Aguarde alguns minutos ou fale com a gente no WhatsApp.',
  },
  PRODUCT_UNAVAILABLE: {
    message: 'Alguns itens esgotaram enquanto você finalizava. Revise o carrinho.',
    refresh: true,
  },
  BELOW_MINIMUM: { message: 'O pedido ainda não atingiu o valor mínimo.', refresh: true },
  INVALID_ADDRESS: {
    message: 'Confira o endereço de entrega.',
  },
  INVALID_CHANGE: { message: 'O valor do troco precisa ser maior que o total do pedido.' },
  PAYMENT_METHOD_NOT_ALLOWED: {
    message: 'Para entrega, o pagamento é feito online (Pix ou cartão). Escolha essa opção para continuar.',
  },
  INVALID_ITEMS: { message: 'Há algum problema com os itens do carrinho. Revise e tente de novo.' },
}

/**
 * Cria o pedido. Todos os valores são recalculados no banco por create_order();
 * nada do que vem do navegador é usado como preço.
 */
export async function createOrder(input: unknown): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Confira os campos destacados.',
      fieldErrors: fieldErrors(parsed.error),
    }
  }

  const ipHash = await requestIpHash()
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('create_order', {
    payload: toCreateOrderPayload(parsed.data, ipHash),
  })

  if (error) {
    const known = FRIENDLY_ERRORS[error.message]
    if (!known) {
      console.error('[createOrder] erro inesperado', error)
      return { ok: false, message: 'Não conseguimos registrar seu pedido. Tente novamente.' }
    }
    return {
      ok: false,
      message: known.message,
      refresh: known.refresh,
      unavailableProductIds:
        error.message === 'PRODUCT_UNAVAILABLE' && error.details ? error.details.split(',') : undefined,
    }
  }

  const result = rpcResultSchema.safeParse(data)
  if (!result.success) {
    console.error('[createOrder] resposta inesperada de create_order', data)
    return { ok: false, message: 'Não conseguimos registrar seu pedido. Tente novamente.' }
  }

  const { id, number, requires_payment } = result.data

  if (!requires_payment) {
    // Depois da resposta, para a cliente não esperar o WhatsApp da loja.
    // Pedido online só avisa a loja quando o pagamento é confirmado.
    after(() => notifyOwnerNewOrder(id))
    return { ok: true, orderId: id, orderNumber: number, paymentUrl: null }
  }

  let paymentUrl: string | null = null
  try {
    const link = await ensurePaymentLink(id)
    if (link.ok) paymentUrl = link.url
  } catch (err) {
    console.error('[createOrder] não foi possível criar o link de pagamento', { orderId: id }, err)
  }
  return { ok: true, orderId: id, orderNumber: number, paymentUrl }
}
