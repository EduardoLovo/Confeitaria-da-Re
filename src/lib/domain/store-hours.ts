import type { Tables } from '@/lib/supabase/database.types'
import { TIME_ZONE } from '@/lib/format'

// A regra oficial de "aberto agora" é a função SQL is_store_open_now().
// Este módulo serve para exibir os horários e calcular "abre ... às ...".

export type OpeningHours = Tables<'opening_hours'>

export const WEEKDAY_LABEL = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/** "10:00:00" → "10h"; "10:30:00" → "10h30" */
export function formatHour(time: string): string {
  const [h, m] = time.split(':')
  return m && m !== '00' ? `${Number(h)}h${m}` : `${Number(h)}h`
}

/** Dia da semana (0–6) e minutos desde 00:00 no fuso da loja. */
export function localClock(now: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { weekday, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Mesma regra do SQL, para testes e para a UI decidir mensagens. */
export function isWithinHours(hours: OpeningHours[], now: Date): boolean {
  const { weekday, minutes } = localClock(now)
  const today = hours.find((h) => h.weekday === weekday)
  if (!today || today.is_closed || !today.opens || !today.closes) return false
  return minutes >= toMinutes(today.opens) && minutes < toMinutes(today.closes)
}

/**
 * Texto curto sobre a próxima abertura, ex.: "Abre hoje às 10h",
 * "Abre amanhã às 10h", "Abre terça às 10h". Null se não houver horário.
 */
export function nextOpeningLabel(hours: OpeningHours[], now: Date): string | null {
  const { weekday, minutes } = localClock(now)
  for (let offset = 0; offset < 7; offset++) {
    const day = (weekday + offset) % 7
    const h = hours.find((x) => x.weekday === day)
    if (!h || h.is_closed || !h.opens) continue
    if (offset === 0 && minutes >= toMinutes(h.opens)) continue
    const when =
      offset === 0 ? 'hoje' : offset === 1 ? 'amanhã' : WEEKDAY_LABEL[day].toLowerCase()
    return `Abre ${when} às ${formatHour(h.opens)}`
  }
  return null
}

/**
 * Agrupa dias consecutivos com o mesmo horário:
 * [{ days: "ter–sáb", hours: "10h às 19h" }, { days: "dom–seg", hours: "Fechado" }]
 */
export function groupOpeningHours(hours: OpeningHours[]): { days: string; hours: string }[] {
  // Começa na segunda para ficar natural em pt-BR.
  const order = [1, 2, 3, 4, 5, 6, 0]
  const label = (h: OpeningHours | undefined) =>
    !h || h.is_closed || !h.opens || !h.closes
      ? 'Fechado'
      : `${formatHour(h.opens)} às ${formatHour(h.closes)}`

  const groups: { start: number; end: number; hours: string }[] = []
  for (const day of order) {
    const text = label(hours.find((h) => h.weekday === day))
    const last = groups.at(-1)
    if (last && last.hours === text) last.end = day
    else groups.push({ start: day, end: day, hours: text })
  }
  return groups.map((g) => ({
    days:
      g.start === g.end ? WEEKDAY_SHORT[g.start] : `${WEEKDAY_SHORT[g.start]}–${WEEKDAY_SHORT[g.end]}`,
    hours: g.hours,
  }))
}
