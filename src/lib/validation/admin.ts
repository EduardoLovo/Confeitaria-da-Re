import { z } from 'zod'

import { onlyDigits, parseBRLToCents } from '@/lib/format'

// ---------- helpers para FormData ----------

/** Checkbox/Switch em FormData: presente ("on"/"true") = true, ausente = false. */
const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null))

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Máximo de ${max} caracteres`)

/** "12,50" → 1250. */
const money = (message: string) =>
  z
    .string()
    .transform((v, ctx) => {
      const cents = parseBRLToCents(v)
      if (cents === null) {
        ctx.addIssue({ code: 'custom', message })
        return z.NEVER
      }
      return cents
    })
    .pipe(z.number().int().min(0).max(10_000_000))

const optionalInt = (max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0 || n > max) {
        ctx.addIssue({ code: 'custom', message: `Informe um número inteiro entre 0 e ${max}` })
        return z.NEVER
      }
      return n
    })

const imagePath = (folder: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (v.startsWith(`${folder}/`) && !v.includes('..')), 'Foto inválida')

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.uuid().optional())

export function formToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData)
}

// ---------- catálogo ----------

export const categorySchema = z.object({
  id: optionalId,
  name: requiredText(80, 'Informe o nome da categoria'),
  is_active: checkbox,
})

export const productSchema = z.object({
  id: optionalId,
  category_id: z.uuid('Escolha a categoria'),
  name: requiredText(120, 'Informe o nome do produto'),
  description: optionalText(500),
  price: money('Informe o preço, ex.: 4,50'),
  image_path: imagePath('products'),
  is_active: checkbox,
  is_available: checkbox,
})

// ---------- encomendas ----------

export const flavorSchema = z.object({
  id: optionalId,
  name: requiredText(80, 'Informe o nome do sabor'),
  description: optionalText(500),
  highlights: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(40, 'Cada diferencial pode ter até 40 caracteres'))
        .max(8, 'Use no máximo 8 diferenciais'),
    ),
  image_path: imagePath('flavors'),
  is_active: checkbox,
})

export const galleryPhotoSchema = z.object({
  image_path: imagePath('gallery').refine((v) => v !== null, 'Envie uma foto'),
  caption: optionalText(200),
})

export const galleryCaptionSchema = z.object({
  id: z.uuid(),
  caption: optionalText(200),
})

// ---------- configurações ----------

/** Aceita com ou sem 55, com máscara; grava sempre 55 + DDD + número. */
export const storeWhatsappSchema = z
  .string()
  .transform(onlyDigits)
  .transform((d) => (d.length === 10 || d.length === 11 ? `55${d}` : d))
  .pipe(z.string().regex(/^55[1-9]{2}\d{8,9}$/, 'Informe o WhatsApp com DDD, ex.: (11) 99999-9999'))

export const storeSettingsSchema = z.object({
  name: requiredText(80, 'Informe o nome da loja'),
  tagline: optionalText(120),
  whatsapp: storeWhatsappSchema,
  instagram_handle: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') : null))
    .refine((v) => v === null || /^[A-Za-z0-9._]{1,30}$/.test(v), 'Use só o @ do Instagram, ex.: minhaloja'),
  pickup_address: optionalText(200),
  min_order: money('Informe o pedido mínimo, ex.: 30,00'),
  delivery_fee: money('Informe a taxa de entrega, ex.: 8,00'),
  logo_path: imagePath('store'),
})

export const customSettingsSchema = z.object({
  custom_intro: optionalText(1000),
  custom_min_quantity: optionalInt(10_000),
  custom_min_lead_days: optionalInt(365),
})

const time = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Horário inválido')

const dayHoursSchema = z
  .object({ weekday: z.number().int().min(0).max(6), open: z.boolean(), opens: time, closes: time })
  .superRefine((d, ctx) => {
    if (!d.open) return
    if (!d.opens || !d.closes) {
      ctx.addIssue({ code: 'custom', message: 'Informe abertura e fechamento', path: ['opens'] })
    } else if (d.closes <= d.opens) {
      ctx.addIssue({ code: 'custom', message: 'O fechamento precisa ser depois da abertura', path: ['closes'] })
    }
  })

/** Lê os 7 dias do FormData (campos open-0, opens-0, closes-0, …). */
export function parseOpeningHours(formData: FormData) {
  const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    open: formData.get(`open-${weekday}`) === 'on',
    opens: String(formData.get(`opens-${weekday}`) ?? ''),
    closes: String(formData.get(`closes-${weekday}`) ?? ''),
  }))
  return z.array(dayHoursSchema).length(7).safeParse(days)
}

export const TEMPLATE_PLACEHOLDERS = ['{nome}', '{numero}', '{total}', '{loja}', '{endereco_retirada}', '{link}'] as const

export const templateBodySchema = requiredText(1000, 'A mensagem não pode ficar vazia')
