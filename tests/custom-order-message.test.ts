import { describe, expect, it } from 'vitest'

import {
  buildCustomOrderMessage,
  earliestPartyDate,
  formatPartyDate,
} from '@/lib/whatsapp/custom-order-message'

describe('buildCustomOrderMessage', () => {
  it('monta a mensagem só com os campos preenchidos', () => {
    const msg = buildCustomOrderMessage({
      name: ' Maria ',
      partyDate: '2026-10-12',
      quantity: 100,
      flavors: ['Brigadeiro tradicional', 'Beijinho'],
      notes: '',
    })
    expect(msg).toBe(
      [
        'Olá! Vim pelo site e gostaria de fazer uma encomenda de docinhos para festa 🎉',
        '',
        'Nome: Maria',
        'Data da festa: 12/10/2026 (segunda-feira)',
        'Quantidade aproximada: 100 docinhos',
        'Sabores de interesse: Brigadeiro tradicional, Beijinho',
      ].join('\n'),
    )
  })

  it('sem nada preenchido vira só a saudação', () => {
    expect(buildCustomOrderMessage({})).toBe(
      'Olá! Vim pelo site e gostaria de fazer uma encomenda de docinhos para festa 🎉',
    )
  })
})

describe('datas da festa', () => {
  it('formata sem deslocar o dia por causa do fuso', () => {
    expect(formatPartyDate('2026-01-01')).toBe('01/01/2026 (quinta-feira)')
  })

  it('antecedência conta a partir de hoje em São Paulo', () => {
    // 02:00 UTC do dia 27 ainda é dia 26 em SP (23h).
    expect(earliestPartyDate(7, new Date('2026-09-27T02:00:00Z'))).toBe('2026-10-03')
    // Vira o mês corretamente.
    expect(earliestPartyDate(10, new Date('2026-09-27T15:00:00Z'))).toBe('2026-10-07')
  })
})
