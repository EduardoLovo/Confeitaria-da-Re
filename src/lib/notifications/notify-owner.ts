import 'server-only'

import { FULFILLMENT_LABEL, paymentLabel } from '@/lib/domain/payment'
import { formatBRL } from '@/lib/format'
import { getSiteUrl } from '@/lib/site-url'
import { createServiceClient } from '@/lib/supabase/admin'

const CALLMEBOT_URL = 'https://api.callmebot.com/whatsapp.php'
const TIMEOUT_MS = 10_000

/**
 * Avisa a confeiteira no WhatsApp que chegou um pedido novo, via CallMeBot
 * (serviço gratuito que só envia mensagens para o próprio número cadastrado).
 *
 * Configuração: CALLMEBOT_RECIPIENTS com um ou mais pares "número:chave"
 * separados por vírgula (ex.: 5511999999999:123456,5511988888888:654321);
 * cada número ativa o bot no próprio celular e recebe a própria chave.
 * Também aceita o formato antigo CALLMEBOT_PHONE + CALLMEBOT_APIKEY (um número só).
 * Sem configuração, não faz nada. Nunca lança erro: uma falha aqui não pode afetar o pedido.
 *
 * Por privacidade (a mensagem passa por um serviço de terceiros), vão só o
 * primeiro nome da cliente, os itens e o total; telefone e endereço ficam no painel.
 */
export async function notifyOwnerNewOrder(orderId: string): Promise<void> {
  const recipients = readRecipients()
  if (recipients.length === 0) return

  try {
    const supabase = createServiceClient()
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, number, customer_name, fulfillment, total_cents, payment_method, order_items(name_snapshot, quantity, sort_order)')
      .eq('id', orderId)
      .single()
    if (error) throw new Error(error.message)

    const items = [...order.order_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => `• ${item.quantity}x ${item.name_snapshot}`)
    const firstName = order.customer_name.trim().split(/\s+/)[0]

    const text = [
      `🧁 *Novo pedido #${order.number}*`,
      `Cliente: ${firstName}`,
      `${FULFILLMENT_LABEL[order.fulfillment]} · ${paymentLabel(order.payment_method, order.fulfillment)}`,
      '',
      ...items,
      '',
      `*Total: ${formatBRL(order.total_cents)}*`,
      `${getSiteUrl()}/admin/pedidos/${order.id}`,
    ].join('\n')

    // Um número com problema não impede o envio para os outros.
    const results = await Promise.allSettled(recipients.map((r) => sendCallMeBot(r, text)))
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`[notifyOwnerNewOrder] falha ao avisar ${maskPhone(recipients[i].phone)}`, result.reason)
      }
    })
  } catch (err) {
    console.error('[notifyOwnerNewOrder] falha ao avisar a loja', err)
  }
}

type Recipient = { phone: string; apiKey: string }

function readRecipients(): Recipient[] {
  const list = process.env.CALLMEBOT_RECIPIENTS?.trim()
  if (list) {
    return list
      .split(',')
      .map((entry) => {
        const [phone = '', apiKey = ''] = entry.split(':')
        return { phone: phone.replace(/\D/g, ''), apiKey: apiKey.trim() }
      })
      .filter((r) => r.phone && r.apiKey)
  }

  const phone = process.env.CALLMEBOT_PHONE?.replace(/\D/g, '')
  const apiKey = process.env.CALLMEBOT_APIKEY?.trim()
  return phone && apiKey ? [{ phone, apiKey }] : []
}

async function sendCallMeBot({ phone, apiKey }: Recipient, text: string): Promise<void> {
  const url = `${CALLMEBOT_URL}?${new URLSearchParams({ phone, apikey: apiKey, text })}`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Só os 4 últimos dígitos no log. */
function maskPhone(phone: string): string {
  return `…${phone.slice(-4)}`
}
