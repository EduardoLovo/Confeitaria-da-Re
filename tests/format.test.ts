import { describe, expect, it } from 'vitest'

import { formatBRL, formatDateTime, maskCEP, maskPhoneBR, parseBRLToCents } from '@/lib/format'

// Intl usa espaço não separável entre "R$" e o número.
const norm = (s: string) => s.replace(/ /g, ' ')

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(norm(formatBRL(1250))).toBe('R$ 12,50')
    expect(norm(formatBRL(0))).toBe('R$ 0,00')
    expect(norm(formatBRL(123456))).toBe('R$ 1.234,56')
  })
})

describe('parseBRLToCents', () => {
  it('aceita formatos comuns', () => {
    expect(parseBRLToCents('12,50')).toBe(1250)
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456)
    expect(parseBRLToCents('100')).toBe(10000)
    expect(parseBRLToCents('4.5')).toBe(450)
  })
  it('rejeita vazio e negativo', () => {
    expect(parseBRLToCents('')).toBeNull()
    expect(parseBRLToCents('-3')).toBeNull()
  })
})

describe('maskPhoneBR', () => {
  it('celular e fixo', () => {
    expect(maskPhoneBR('11987654321')).toBe('(11) 98765-4321')
    expect(maskPhoneBR('1133334444')).toBe('(11) 3333-4444')
  })
  it('máscara parcial enquanto digita', () => {
    expect(maskPhoneBR('1')).toBe('(1')
    expect(maskPhoneBR('1198')).toBe('(11) 98')
  })
  it('remove o 55 colado e limita a 11 dígitos', () => {
    expect(maskPhoneBR('5511987654321')).toBe('(11) 98765-4321')
    expect(maskPhoneBR('119876543210000')).toBe('(11) 98765-4321')
  })
})

describe('maskCEP', () => {
  it('insere o hífen', () => {
    expect(maskCEP('01310100')).toBe('01310-100')
    expect(maskCEP('0131')).toBe('0131')
  })
})

describe('formatDateTime', () => {
  it('usa o fuso de São Paulo', () => {
    // 15:30 UTC = 12:30 em São Paulo (UTC-3)
    expect(formatDateTime('2026-09-26T15:30:00Z')).toBe('26/09/2026, 12:30')
  })
})
