export const TIME_ZONE = 'America/Sao_Paulo'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 1250 → "R$ 12,50" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100)
}

/** "12,50" | "12.50" | "R$ 12,50" → 1250. Retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').trim()
  if (!cleaned) return null
  // Formato BR: ponto é milhar, vírgula é decimal.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const timeOnly = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

const dateKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** "AAAA-MM-DD" no fuso da loja (para comparar dias). */
export function localDateKey(iso: string | Date): string {
  return dateKey.format(new Date(iso))
}

export function formatDateTime(iso: string | Date): string {
  return dateTime.format(new Date(iso))
}

export function formatTime(iso: string | Date): string {
  return timeOnly.format(new Date(iso))
}

/** Mantém só dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Máscara de telefone BR enquanto a pessoa digita.
 * "11987654321" → "(11) 98765-4321"; "1133334444" → "(11) 3333-4444".
 */
export function maskPhoneBR(value: string): string {
  let d = onlyDigits(value)
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  d = d.slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** "01310100" → "01310-100" */
export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** 1 → "1 docinho"; 50 → "50 docinhos" */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
