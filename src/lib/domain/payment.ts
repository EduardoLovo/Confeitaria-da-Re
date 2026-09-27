import type { FulfillmentType, PaymentMethod } from '@/lib/supabase/database.types'

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['pix_on_delivery', 'cash', 'card_on_delivery']

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
