import 'server-only'

import { z } from 'zod'

/**
 * Cliente mínimo do Checkout Integrado da InfinitePay.
 * Docs: https://www.infinitepay.io/checkout-documentacao
 *
 * A API não usa chave secreta: a conta é identificada só pela InfiniteTag
 * (INFINITEPAY_HANDLE). Por isso, NADA que chega de fora (webhook, parâmetros
 * da volta do checkout) é confiável: o pagamento só vale depois de
 * confirmado por checkPayment().
 */

const API_URL = 'https://api.checkout.infinitepay.io'
const TIMEOUT_MS = 10_000

export class InfinitePayError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'InfinitePayError'
  }
}

/** InfiniteTag da loja, sem o "$". */
export function infinitePayHandle(): string {
  const handle = process.env.INFINITEPAY_HANDLE?.trim().replace(/^\$/, '')
  if (!handle) throw new InfinitePayError('Defina INFINITEPAY_HANDLE (a InfiniteTag da loja, sem o $).')
  return handle
}

async function post(path: string, body: unknown): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    throw new InfinitePayError(`${path}: sem resposta da InfinitePay`, err)
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // resposta não-JSON: vai no erro abaixo
  }
  if (!res.ok) throw new InfinitePayError(`${path}: HTTP ${res.status}`, json ?? text.slice(0, 500))
  return json
}

// -------------------------------------------------------------
// Criar link de pagamento
// -------------------------------------------------------------

export type CheckoutLinkInput = {
  orderNsu: string
  items: { description: string; quantity: number; priceCents: number }[]
  redirectUrl: string
  webhookUrl: string
  customer?: { name: string; phoneNumber?: string }
  address?: { cep?: string; street?: string; neighborhood?: string; number?: string; complement?: string }
}

/**
 * A documentação não mostra o formato da resposta; aceitamos o link em
 * qualquer um destes campos (o primeiro que for uma URL https).
 */
const LINK_FIELDS = ['url', 'link', 'checkout_url', 'payment_url'] as const

export async function createCheckoutLink(input: CheckoutLinkInput): Promise<string> {
  const data = await post('/links', {
    handle: infinitePayHandle(),
    order_nsu: input.orderNsu,
    redirect_url: input.redirectUrl,
    webhook_url: input.webhookUrl,
    items: input.items.map((item) => ({
      description: item.description.slice(0, 100),
      quantity: item.quantity,
      price: item.priceCents,
    })),
    ...(input.customer && {
      customer: {
        name: input.customer.name,
        ...(input.customer.phoneNumber && { phone_number: input.customer.phoneNumber }),
      },
    }),
    ...(input.address && { address: input.address }),
  })

  if (data && typeof data === 'object') {
    for (const field of LINK_FIELDS) {
      const value = (data as Record<string, unknown>)[field]
      if (typeof value === 'string' && value.startsWith('https://')) return value
    }
  }
  throw new InfinitePayError('/links: resposta sem o link de pagamento', data)
}

// -------------------------------------------------------------
// Consultar pagamento
// -------------------------------------------------------------

const paymentCheckSchema = z.object({
  success: z.boolean(),
  paid: z.boolean(),
  amount: z.number().int().nonnegative().optional(),
  paid_amount: z.number().int().nonnegative().optional(),
  installments: z.number().int().optional(),
  capture_method: z.string().optional(),
})

export type PaymentCheck = z.infer<typeof paymentCheckSchema>

export async function checkPayment(input: {
  orderNsu: string
  transactionNsu: string
  slug: string
}): Promise<PaymentCheck> {
  const data = await post('/payment_check', {
    handle: infinitePayHandle(),
    order_nsu: input.orderNsu,
    transaction_nsu: input.transactionNsu,
    slug: input.slug,
  })
  const parsed = paymentCheckSchema.safeParse(data)
  if (!parsed.success) throw new InfinitePayError('/payment_check: resposta inesperada', data)
  return parsed.data
}
