import { describe, expect, it } from 'vitest'

import {
  groupOpeningHours,
  isWithinHours,
  nextOpeningLabel,
  type OpeningHours,
} from '@/lib/domain/store-hours'

// Ter–sáb 10h–19h (igual ao seed)
const hours: OpeningHours[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
  weekday <= 1
    ? { weekday, is_closed: true, opens: null, closes: null }
    : { weekday, is_closed: false, opens: '10:00:00', closes: '19:00:00' },
)

// 2026-09-26 é sábado. Horário de São Paulo = UTC-3.
const sp = (isoLocal: string) => new Date(`${isoLocal}-03:00`)

describe('isWithinHours', () => {
  it('aberto dentro do horário', () => {
    expect(isWithinHours(hours, sp('2026-09-26T10:00:00'))).toBe(true)
    expect(isWithinHours(hours, sp('2026-09-26T18:59:00'))).toBe(true)
  })
  it('fechado fora do horário e nos dias de folga', () => {
    expect(isWithinHours(hours, sp('2026-09-26T09:59:00'))).toBe(false)
    expect(isWithinHours(hours, sp('2026-09-26T19:00:00'))).toBe(false)
    expect(isWithinHours(hours, sp('2026-09-27T12:00:00'))).toBe(false) // domingo
  })
  it('usa o fuso da loja, não o do servidor', () => {
    // 01:00 UTC de domingo ainda é sábado 22h em SP → fechado, mas por horário.
    expect(isWithinHours(hours, new Date('2026-09-27T01:00:00Z'))).toBe(false)
    // 21:00 UTC de sábado = 18h em SP → aberto
    expect(isWithinHours(hours, new Date('2026-09-26T21:00:00Z'))).toBe(true)
  })
})

describe('nextOpeningLabel', () => {
  it('antes de abrir hoje', () => {
    expect(nextOpeningLabel(hours, sp('2026-09-26T08:00:00'))).toBe('Abre hoje às 10h')
  })
  it('sábado à noite → terça', () => {
    expect(nextOpeningLabel(hours, sp('2026-09-26T20:00:00'))).toBe('Abre terça às 10h')
  })
  it('segunda → amanhã', () => {
    expect(nextOpeningLabel(hours, sp('2026-09-28T12:00:00'))).toBe('Abre amanhã às 10h')
  })
})

describe('groupOpeningHours', () => {
  it('agrupa dias iguais consecutivos', () => {
    expect(groupOpeningHours(hours)).toEqual([
      { days: 'seg', hours: 'Fechado' },
      { days: 'ter–sáb', hours: '10h às 19h' },
      { days: 'dom', hours: 'Fechado' },
    ])
  })
})
