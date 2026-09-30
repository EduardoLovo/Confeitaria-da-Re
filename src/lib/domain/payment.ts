import type { FulfillmentType, PaymentMethod } from '@/lib/supabase/database.types'

/**
 * Formas de pagamento ACEITAS no checkout (fonte única: formulário e validação
 * no servidor). "cash" continua existindo no banco só para pedidos antigos;
 * para voltar a aceitar dinheiro, basta incluí-lo aqui e reativar o campo de troco.
 */
export const ACCEPTED_PAYMENT_METHODS = [
  'online',
  'pix_on_delivery',
  'card_on_delivery',
] as const satisfies readonly PaymentMethod[]

export type AcceptedPaymentMethod = (typeof ACCEPTED_PAYMENT_METHODS)[number]

/**
 * Entrega: só online (a loja não sai para entregar sem receber).
 * Retirada: a cliente escolhe pagar online agora ou na retirada.
 * Espelha a regra de create_order() (erro PAYMENT_METHOD_NOT_ALLOWED).
 */
export function paymentMethodsFor(fulfillment: FulfillmentType): readonly AcceptedPaymentMethod[] {
  return fulfillment === 'delivery' ? ['online'] : ACCEPTED_PAYMENT_METHODS
}

/** Minutos que a cliente tem para pagar online (igual a create_order()). */
export const ONLINE_PAYMENT_WINDOW_MINUTES = 30

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
    case 'online':
      return 'Online (Pix ou cartão)'
  }
}

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  delivery: 'Entrega',
  pickup: 'Retirada',
}
