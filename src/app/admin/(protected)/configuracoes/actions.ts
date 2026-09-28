'use server'

import { revalidatePath } from 'next/cache'

import { adminAction, dbFailed, validationFailed, type ActionResult } from '@/lib/admin/action-result'
import { removeImages } from '@/lib/admin/storage'
import { requireAdminAction } from '@/lib/auth'
import type { OrderStatus } from '@/lib/supabase/database.types'
import {
  customSettingsSchema,
  formToObject,
  parseOpeningHours,
  storeSettingsSchema,
  templateBodySchema,
} from '@/lib/validation/admin'
import { fieldErrors } from '@/lib/validation/order'

function revalidateStore() {
  // Nome, horário e "aberto agora" aparecem em todas as páginas.
  revalidatePath('/', 'layout')
}

export async function setOpenSwitch(value: boolean): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const { error } = await session.supabase.from('store_settings').update({ is_open_switch: value }).eq('id', true)
    if (error) return dbFailed(error, 'abrir/fechar loja')
    revalidateStore()
    return { ok: true, message: value ? 'Loja aberta (dentro do horário)' : 'Loja fechada para pedidos' }
  })
}

export async function saveStoreSettings(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = storeSettingsSchema.safeParse(formToObject(formData))
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    const { min_order, delivery_fee, ...fields } = parsed.data

    const { data: current } = await session.supabase.from('store_settings').select('logo_path').eq('id', true).single()
    const { error } = await session.supabase
      .from('store_settings')
      .update({ ...fields, min_order_cents: min_order, delivery_fee_cents: delivery_fee })
      .eq('id', true)
    if (error) return dbFailed(error, 'salvar dados da loja')

    if (current?.logo_path && current.logo_path !== fields.logo_path) await removeImages(session, [current.logo_path])
    revalidateStore()
    return { ok: true, message: 'Dados da loja salvos' }
  })
}

export async function saveOpeningHours(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = parseOpeningHours(formData)
    if (!parsed.success) {
      // Erros por dia: "opens-2", "closes-5"…
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const [day, field] = issue.path
        errors[`${String(field)}-${String(day)}`] ??= issue.message
      }
      return { ok: false, message: 'Confira os horários destacados.', errors }
    }
    const session = await requireAdminAction()
    const rows = parsed.data.map((d) => ({
      weekday: d.weekday,
      is_closed: !d.open,
      opens: d.open ? d.opens : null,
      closes: d.open ? d.closes : null,
    }))
    const { error } = await session.supabase.from('opening_hours').upsert(rows, { onConflict: 'weekday' })
    if (error) return dbFailed(error, 'salvar horários')
    revalidateStore()
    return { ok: true, message: 'Horários salvos' }
  })
}

export async function saveCustomSettings(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = customSettingsSchema.safeParse(formToObject(formData))
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    const { error } = await session.supabase.from('store_settings').update(parsed.data).eq('id', true)
    if (error) return dbFailed(error, 'salvar encomendas')
    revalidatePath('/encomendas')
    revalidatePath('/admin/configuracoes')
    return { ok: true, message: 'Configurações de encomendas salvas' }
  })
}

const STATUSES: OrderStatus[] = ['received', 'confirmed', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled']

export async function saveTemplates(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const rows: { status: OrderStatus; body: string }[] = []
    const errors: Record<string, string> = {}
    for (const status of STATUSES) {
      const parsed = templateBodySchema.safeParse(String(formData.get(`tpl-${status}`) ?? ''))
      if (parsed.success) rows.push({ status, body: parsed.data })
      else errors[`tpl-${status}`] = fieldErrors(parsed.error)._form
    }
    if (Object.keys(errors).length) return { ok: false, message: 'Confira as mensagens destacadas.', errors }

    const session = await requireAdminAction()
    const { error } = await session.supabase.from('whatsapp_templates').upsert(rows, { onConflict: 'status' })
    if (error) return dbFailed(error, 'salvar mensagens')
    revalidatePath('/admin/configuracoes')
    return { ok: true, message: 'Mensagens salvas' }
  })
}
