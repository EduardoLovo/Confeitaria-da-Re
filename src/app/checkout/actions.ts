'use server'

import { z } from 'zod'

import { requestIpHash } from '@/lib/security/ip-hash'
import { createServiceClient } from '@/lib/supabase/admin'
import { checkoutSchema, fieldErrors, toCreateOrderPayload } from '@/lib/validation/order'

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string>
      /** Produtos que esgotaram/saíram do cardápio: a página recarrega o catálogo. */
      unavailableProductIds?: string[]
      /** O front deve recarregar os dados do servidor (catálogo, bairros, loja). */
      refresh?: boolean
    }

const rpcResultSchema = z.object({ id: z.uuid(), number: z.number().int() })

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
  INVALID_ZONE: {
    message: 'Esse bairro não está mais na nossa área de entrega. Escolha outro ou retire na loja.',
    refresh: true,
  },
  INVALID_CHANGE: { message: 'O valor do troco precisa ser maior que o total do pedido.' },
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
      fieldErrors: error.message === 'INVALID_CHANGE' ? { changeForCents: known.message } : undefined,
      unavailableProductIds:
        error.message === 'PRODUCT_UNAVAILABLE' && error.details ? error.details.split(',') : undefined,
    }
  }

  const result = rpcResultSchema.safeParse(data)
  if (!result.success) {
    console.error('[createOrder] resposta inesperada de create_order', data)
    return { ok: false, message: 'Não conseguimos registrar seu pedido. Tente novamente.' }
  }

  return { ok: true, orderId: result.data.id, orderNumber: result.data.number }
}
