'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { adminAction, dbFailed, validationFailed, type ActionResult } from '@/lib/admin/action-result'
import { applyOrder, removeImages } from '@/lib/admin/storage'
import { requireAdminAction } from '@/lib/auth'
import { flavorSchema, formToObject, galleryCaptionSchema, galleryPhotoSchema } from '@/lib/validation/admin'

function revalidateCustom() {
  revalidatePath('/admin/encomendas')
  revalidatePath('/encomendas')
}

const ids = z.array(z.uuid()).max(500)

// ---------- sabores ----------

export async function saveFlavor(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = flavorSchema.safeParse(formToObject(formData))
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    const { id, ...row } = parsed.data

    let oldImage: string | null = null
    if (id) {
      const { data: current } = await session.supabase.from('custom_flavors').select('image_path').eq('id', id).single()
      oldImage = current?.image_path ?? null
      const { error } = await session.supabase.from('custom_flavors').update(row).eq('id', id)
      if (error) return dbFailed(error, 'salvar sabor')
    } else {
      const { error } = await session.supabase.from('custom_flavors').insert({ ...row, sort_order: 999 })
      if (error) return dbFailed(error, 'criar sabor')
    }

    if (oldImage && oldImage !== row.image_path) await removeImages(session, [oldImage])
    revalidateCustom()
    redirect('/admin/encomendas')
  })
}

export async function deleteFlavor(id: string): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const flavorId = z.uuid().parse(id)
    const { data: current } = await session.supabase.from('custom_flavors').select('image_path').eq('id', flavorId).single()
    const { error } = await session.supabase.from('custom_flavors').delete().eq('id', flavorId)
    if (error) return dbFailed(error, 'excluir sabor')
    await removeImages(session, [current?.image_path])
    revalidateCustom()
    redirect('/admin/encomendas')
  })
}

export async function setFlavorActive(id: string, value: boolean): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const { error } = await session.supabase
      .from('custom_flavors')
      .update({ is_active: value })
      .eq('id', z.uuid().parse(id))
    if (error) return dbFailed(error, 'ativar sabor')
    revalidateCustom()
    return { ok: true }
  })
}

export async function reorderFlavors(list: string[]): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const error = await applyOrder(session, 'custom_flavors', ids.parse(list))
    if (error) return dbFailed(error, 'ordenar sabores')
    revalidateCustom()
    return { ok: true }
  })
}

// ---------- galeria ----------

export async function addGalleryPhoto(imagePath: string): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = galleryPhotoSchema.safeParse({ image_path: imagePath })
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    // sort_order 0 = aparece primeiro; o admin pode reordenar depois.
    const { error } = await session.supabase
      .from('custom_gallery')
      .insert({ image_path: parsed.data.image_path!, caption: null, sort_order: 0 })
    if (error) return dbFailed(error, 'adicionar foto')
    revalidateCustom()
    return { ok: true, message: 'Foto adicionada' }
  })
}

export async function saveGalleryCaption(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = galleryCaptionSchema.safeParse(formToObject(formData))
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    const { error } = await session.supabase
      .from('custom_gallery')
      .update({ caption: parsed.data.caption })
      .eq('id', parsed.data.id)
    if (error) return dbFailed(error, 'salvar legenda')
    revalidateCustom()
    return { ok: true, message: 'Legenda salva' }
  })
}

export async function setGalleryActive(id: string, value: boolean): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const { error } = await session.supabase
      .from('custom_gallery')
      .update({ is_active: value })
      .eq('id', z.uuid().parse(id))
    if (error) return dbFailed(error, 'ativar foto')
    revalidateCustom()
    return { ok: true }
  })
}

export async function reorderGallery(list: string[]): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const error = await applyOrder(session, 'custom_gallery', ids.parse(list))
    if (error) return dbFailed(error, 'ordenar galeria')
    revalidateCustom()
    return { ok: true }
  })
}

export async function deleteGalleryPhoto(id: string): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const photoId = z.uuid().parse(id)
    const { data: current } = await session.supabase.from('custom_gallery').select('image_path').eq('id', photoId).single()
    const { error } = await session.supabase.from('custom_gallery').delete().eq('id', photoId)
    if (error) return dbFailed(error, 'excluir foto')
    await removeImages(session, [current?.image_path])
    revalidateCustom()
    return { ok: true, message: 'Foto excluída' }
  })
}
