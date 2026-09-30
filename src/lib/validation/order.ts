import { z } from 'zod'

import { MAX_ITEM_QUANTITY, MAX_NOTE_LENGTH } from '@/lib/domain/cart'
import { ACCEPTED_PAYMENT_METHODS } from '@/lib/domain/payment'
import { onlyDigits } from '@/lib/format'

// Esquema único do checkout: validado no navegador (mensagens por campo)
// e de novo no servidor, antes de chamar create_order().

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} pode ter no máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined))

/** DDD (sem zero) + 8 ou 9 dígitos, sem o 55. */
export const phoneSchema = z
  .string()
  .transform(onlyDigits)
  .pipe(z.string().regex(/^[1-9]{2}\d{8,9}$/, 'Informe um WhatsApp com DDD, ex.: (11) 98765-4321'))

export const orderItemSchema = z.object({
  productId: z.uuid('Item inválido'),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
  note: optionalText(MAX_NOTE_LENGTH, 'A observação do item'),
})

const baseOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Informe seu nome')
    .max(100, 'Nome muito longo'),
  customerPhone: phoneSchema,
  paymentMethod: z.enum(ACCEPTED_PAYMENT_METHODS, 'Escolha a forma de pagamento'),
  notes: optionalText(500, 'As observações'),
  items: z.array(orderItemSchema).min(1, 'Seu carrinho está vazio').max(50, 'Itens demais no carrinho'),
})

const deliverySchema = baseOrderSchema.extend({
  fulfillment: z.literal('delivery'),
  // Entrega só com pagamento online (ver paymentMethodsFor).
  paymentMethod: z.literal('online', 'Para entrega, o pagamento é online (Pix ou cartão)'),
  neighborhood: z.string('Informe o bairro').trim().min(2, 'Informe o bairro').max(80, 'Bairro muito longo'),
  cep: z
    .string()
    .transform(onlyDigits)
    .pipe(z.union([z.literal(''), z.string().length(8, 'CEP deve ter 8 dígitos')]))
    .optional()
    .transform((v) => (v ? v : undefined)),
  street: z.string().trim().min(2, 'Informe a rua').max(150, 'Rua muito longa'),
  streetNumber: z.string().trim().min(1, 'Informe o número').max(20, 'Número muito longo'),
  complement: optionalText(100, 'O complemento'),
  addressReference: optionalText(150, 'A referência'),
})

const pickupSchema = baseOrderSchema.extend({
  fulfillment: z.literal('pickup'),
})

export const checkoutSchema = z.discriminatedUnion('fulfillment', [deliverySchema, pickupSchema], {
  error: 'Escolha entrega ou retirada',
})

export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutData = z.output<typeof checkoutSchema>

/** Primeiro erro de cada campo, no formato { "street": "Informe a rua", "items": "..." }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_form'
    out[key] ??= issue.message
  }
  return out
}

/** Converte para o payload JSON esperado pela função SQL create_order(). */
export function toCreateOrderPayload(data: CheckoutData, ipHash: string | null) {
  return {
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    fulfillment: data.fulfillment,
    payment_method: data.paymentMethod,
    change_for_cents: null, // Dinheiro não é aceito (ver ACCEPTED_PAYMENT_METHODS)
    notes: data.notes ?? null,
    ip_hash: ipHash,
    ...(data.fulfillment === 'delivery'
      ? {
          neighborhood: data.neighborhood,
          cep: data.cep ?? null,
          street: data.street,
          street_number: data.streetNumber,
          complement: data.complement ?? null,
          address_reference: data.addressReference ?? null,
        }
      : {}),
    items: data.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      note: i.note ?? null,
    })),
  }
}
