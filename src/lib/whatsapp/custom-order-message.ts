import { pluralize, TIME_ZONE } from '@/lib/format'

export type CustomOrderRequest = {
  name?: string
  /** "AAAA-MM-DD" (valor do <input type="date">) */
  partyDate?: string
  quantity?: number
  flavors?: string[]
  notes?: string
}

/** "2026-10-12" → "12/10/2026 (segunda-feira)". Sem conversão de fuso: é uma data de calendário. */
export function formatPartyDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(date)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} (${weekday})`
}

/**
 * Mensagem pronta para o WhatsApp da loja. Campos vazios são omitidos;
 * sem nenhum campo, vira um "oi, quero encomendar" simples.
 */
export function buildCustomOrderMessage(req: CustomOrderRequest): string {
  const lines: string[] = []
  const name = req.name?.trim()
  const notes = req.notes?.trim()
  const flavors = (req.flavors ?? []).filter(Boolean)

  if (name) lines.push(`Nome: ${name}`)
  if (req.partyDate) lines.push(`Data da festa: ${formatPartyDate(req.partyDate)}`)
  if (req.quantity && req.quantity > 0) lines.push(`Quantidade aproximada: ${pluralize(req.quantity, 'docinho')}`)
  if (flavors.length) lines.push(`Sabores de interesse: ${flavors.join(', ')}`)
  if (notes) lines.push(`Tema/observações: ${notes}`)

  const greeting = 'Olá! Vim pelo site e gostaria de fazer uma encomenda de docinhos para festa 🎉'
  return lines.length ? `${greeting}\n\n${lines.join('\n')}` : greeting
}

/** Hoje + N dias, no fuso da loja, como "AAAA-MM-DD" (para o atributo min do input de data). */
export function earliestPartyDate(leadDays: number, now = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // "AAAA-MM-DD"
  const [y, m, d] = today.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1, d + leadDays))
  return target.toISOString().slice(0, 10)
}
