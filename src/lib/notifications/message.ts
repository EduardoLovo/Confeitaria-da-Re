import { formatBRL } from '@/lib/format'
import type { FulfillmentType, OrderStatus } from '@/lib/supabase/database.types'

export type MessageOrder = {
  number: number
  customer_name: string
  total_cents: number
  fulfillment: FulfillmentType
}

export type MessageStore = { name: string; pickup_address: string | null }

/** Usados se a loja ainda não tiver cadastrado o texto daquele status. */
export const DEFAULT_TEMPLATES: Record<OrderStatus, string> = {
  received: 'Oi, {nome}! Recebemos seu pedido #{numero} 💕 Já já confirmamos por aqui.',
  confirmed: 'Oi, {nome}! Seu pedido #{numero} foi confirmado e já está sendo preparado com carinho 🍫 Total: {total}.',
  out_for_delivery: 'Oba, {nome}! Seu pedido #{numero} saiu para entrega 🛵 Logo chega aí!',
  ready_for_pickup: 'Oi, {nome}! Seu pedido #{numero} está pronto para retirada em {endereco_retirada} 🎀',
  completed: 'Obrigada, {nome}! Pedido #{numero} concluído. Esperamos que você ame seus docinhos 💖',
  cancelled: 'Oi, {nome}. Seu pedido #{numero} foi cancelado. Qualquer dúvida, é só chamar aqui 🙏',
}

/** Troca {nome}, {numero}, {total}, {loja}, {endereco_retirada}. Placeholders desconhecidos ficam como estão. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match))
}

/** Mensagem final para a cliente, a partir do template do status. */
export function buildCustomerMessage({
  order,
  status,
  template,
  store,
}: {
  order: MessageOrder
  status: OrderStatus
  template: string | null | undefined
  store: MessageStore
}): string {
  const firstName = order.customer_name.trim().split(/\s+/)[0] ?? ''
  return renderTemplate(template?.trim() || DEFAULT_TEMPLATES[status], {
    nome: firstName,
    numero: String(order.number),
    total: formatBRL(order.total_cents).replace(/ /g, ' '),
    loja: store.name,
    endereco_retirada: store.pickup_address ?? 'nossa loja',
  })
}
