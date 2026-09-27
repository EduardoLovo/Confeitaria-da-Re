import type { FulfillmentType, PaymentMethod } from '@/lib/supabase/database.types'

/**
 * Formas de pagamento ACEITAS no checkout (fonte única: formulário e validação
 * no servidor). "cash" continua existindo no banco só para pedidos antigos;
 * para voltar a aceitar dinheiro, basta incluí-lo aqui e reativar o campo de troco.
 */
export const ACCEPTED_PAYMENT_METHODS = ['pix_on_delivery', 'card_on_delivery'] as const satisfies readonly PaymentMethod[]

export type AcceptedPaymentMethod = (typeof ACCEPTED_PAYMENT_METHODS)[number]

/** Rótulo curto; o complemento depende de ser entrega ou retirada. */
export function paymentLabel(method: PaymentMethod, fulfillment?: FulfillmentType): string {
  const when = fulfillment === 'pickup' ? 'na retirada' : fulfillment === 'delivery' ? 'na entrega' : 'na entrega/retirada'
  switch (method) {
    case 'pix_on_delivery':
      return `Pix ${when}`
    case 'cash':
      return 'Dinheiro'
    case 'card_on_delivery':
      return `Cartão ${when}`
  }
}

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  delivery: 'Entrega',
  pickup: 'Retirada',
}
