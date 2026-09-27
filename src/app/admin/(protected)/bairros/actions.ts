'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { adminAction, dbFailed, validationFailed, type ActionResult } from '@/lib/admin/action-result'
import { applyOrder } from '@/lib/admin/storage'
import { requireAdminAction } from '@/lib/auth'
import { formToObject, zoneSchema } from '@/lib/validation/admin'

function revalidateZones() {
  revalidatePath('/admin/bairros')
  revalidatePath('/checkout')
}

export async function saveZone(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = zoneSchema.safeParse(formToObject(formData))
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    const { id, neighborhood, fee, is_active } = parsed.data
    const row = { neighborhood, fee_cents: fee, is_active }

    const { error } = id
      ? await session.supabase.from('delivery_zones').update(row).eq('id', id)
      : await session.supabase.from('delivery_zones').insert({ ...row, sort_order: 999 })
    if (error?.code === '23505') return { ok: false, message: 'Esse bairro já está cadastrado.', errors: { neighborhood: 'Bairro já cadastrado' } }
    if (error) return dbFailed(error, 'salvar bairro')

    revalidateZones()
    return { ok: true, message: id ? 'Bairro atualizado' : 'Bairro adicionado' }
  })
}

export async function setZoneActive(id: string, value: boolean): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const { error } = await session.supabase
      .from('delivery_zones')
      .update({ is_active: value })
      .eq('id', z.uuid().parse(id))
    if (error) return dbFailed(error, 'ativar bairro')
    revalidateZones()
    return { ok: true }
  })
}

export async function deleteZone(id: string): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    // Pedidos antigos guardam o nome do bairro (snapshot); o vínculo vira nulo.
    const { error } = await session.supabase.from('delivery_zones').delete().eq('id', z.uuid().parse(id))
    if (error) return dbFailed(error, 'excluir bairro')
    revalidateZones()
    return { ok: true, message: 'Bairro excluído' }
  })
}

export async function reorderZones(list: string[]): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const error = await applyOrder(session, 'delivery_zones', z.array(z.uuid()).max(500).parse(list))
    if (error) return dbFailed(error, 'ordenar bairros')
    revalidateZones()
    return { ok: true }
  })
}
