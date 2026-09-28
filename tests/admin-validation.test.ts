import { describe, expect, it } from 'vitest'

import { slugify } from '@/lib/slug'
import {
  customSettingsSchema,
  flavorSchema,
  parseOpeningHours,
  productSchema,
  storeSettingsSchema,
} from '@/lib/validation/admin'

const CATEGORY = '00000000-0000-4000-8000-00000000000a'

describe('slugify', () => {
  it('gera slugs limpos', () => {
    expect(slugify('Brigadeiros Gourmet!')).toBe('brigadeiros-gourmet')
    expect(slugify('  Pão de Mel & Cia ')).toBe('pao-de-mel-cia')
    expect(slugify('!!!')).toBe('categoria')
  })
})

describe('productSchema', () => {
  it('converte preço e checkboxes do FormData', () => {
    const p = productSchema.parse({
      category_id: CATEGORY,
      name: ' Trufa ',
      price: '7,50',
      description: '',
      image_path: 'products/abc.webp',
      is_active: 'on',
    })
    expect(p).toMatchObject({ name: 'Trufa', price: 750, description: null, is_active: true, is_available: false })
  })

  it('rejeita preço inválido e foto fora da pasta', () => {
    const r = productSchema.safeParse({ category_id: CATEGORY, name: 'X', price: 'abc', image_path: '../etc/passwd' })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path[0])
    expect(paths).toContain('price')
    expect(paths).toContain('image_path')
  })
})

describe('storeSettingsSchema', () => {
  const base = { name: 'Loja', min_order: '30,00', delivery_fee: '8,00' }

  it('normaliza WhatsApp e Instagram', () => {
    const s = storeSettingsSchema.parse({
      ...base,
      whatsapp: '(11) 98765-4321',
      instagram_handle: 'https://instagram.com/confeitaria.re/',
    })
    expect(s.whatsapp).toBe('5511987654321')
    expect(s.instagram_handle).toBe('confeitaria.re')
    expect(s.min_order).toBe(3000)
  })

  it('aceita número já com 55 e @ no Instagram', () => {
    const s = storeSettingsSchema.parse({ ...base, whatsapp: '5511987654321', instagram_handle: '@loja' })
    expect(s.whatsapp).toBe('5511987654321')
    expect(s.instagram_handle).toBe('loja')
  })

  it('rejeita WhatsApp sem DDD', () => {
    expect(storeSettingsSchema.safeParse({ ...base, whatsapp: '98765-4321' }).success).toBe(false)
  })
})

describe('flavorSchema', () => {
  it('separa diferenciais por vírgula ou linha', () => {
    const f = flavorSchema.parse({ name: 'Ninho', highlights: 'Leite Ninho, Nutella\n Granulado ,' })
    expect(f.highlights).toEqual(['Leite Ninho', 'Nutella', 'Granulado'])
  })
})

describe('customSettingsSchema', () => {
  it('campos vazios viram null; texto inválido dá erro', () => {
    expect(customSettingsSchema.parse({ custom_min_quantity: '', custom_min_lead_days: '7' })).toMatchObject({
      custom_min_quantity: null,
      custom_min_lead_days: 7,
    })
    expect(customSettingsSchema.safeParse({ custom_min_quantity: '1,5' }).success).toBe(false)
  })
})

describe('parseOpeningHours', () => {
  function form(entries: Record<string, string>) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(entries)) fd.set(k, v)
    return fd
  }

  it('dia desligado fica fechado, mesmo com horários preenchidos', () => {
    const r = parseOpeningHours(form({ 'open-2': 'on', 'opens-2': '10:00', 'closes-2': '19:00', 'opens-0': '10:00' }))
    expect(r.success).toBe(true)
    expect(r.data!.find((d) => d.weekday === 2)).toMatchObject({ open: true, opens: '10:00', closes: '19:00' })
    expect(r.data!.find((d) => d.weekday === 0)?.open).toBe(false)
  })

  it('fechamento antes da abertura é erro no dia certo', () => {
    const r = parseOpeningHours(form({ 'open-3': 'on', 'opens-3': '18:00', 'closes-3': '09:00' }))
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].path).toEqual([3, 'closes'])
  })
})
