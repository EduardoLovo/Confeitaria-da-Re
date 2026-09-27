'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { adminAction, dbFailed, validationFailed, type ActionResult } from '@/lib/admin/action-result'
import { applyOrder, removeImages } from '@/lib/admin/storage'
import { requireAdminAction, type AdminSession } from '@/lib/auth'
import { slugify } from '@/lib/slug'
import { categorySchema, formToObject, productSchema } from '@/lib/validation/admin'

function revalidateCatalog() {
  revalidatePath('/admin/produtos')
  revalidatePath('/pronta-entrega')
}

const ids = z.array(z.uuid()).max(500)

// ---------- categorias ----------

async function uniqueSlug(session: AdminSession, name: string, ignoreId?: string) {
  const base = slugify(name)
  const { data } = await session.supabase.from('categories').select('id, slug').like('slug', `${base}%`)
  const taken = new Set((data ?? []).filter((c) => c.id !== ignoreId).map((c) => c.slug))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = categorySchema.safeParse(formToObject(formData))
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    const { id, name, is_active } = parsed.data
    const slug = await uniqueSlug(session, name, id)

    const { error } = id
      ? await session.supabase.from('categories').update({ name, slug, is_active }).eq('id', id)
      : await session.supabase.from('categories').insert({ name, slug, is_active, sort_order: 999 })
    if (error) return dbFailed(error, 'salvar categoria')

    revalidateCatalog()
    return { ok: true, message: id ? 'Categoria atualizada' : 'Categoria criada' }
  })
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const { error } = await session.supabase.from('categories').delete().eq('id', z.uuid().parse(id))
    if (error?.code === '23503') {
      return { ok: false, message: 'Mova ou exclua os produtos desta categoria antes de excluí-la.' }
    }
    if (error) return dbFailed(error, 'excluir categoria')
    revalidateCatalog()
    return { ok: true, message: 'Categoria excluída' }
  })
}

export async function setCategoryActive(id: string, value: boolean): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const { error } = await session.supabase
      .from('categories')
      .update({ is_active: value })
      .eq('id', z.uuid().parse(id))
    if (error) return dbFailed(error, 'ativar categoria')
    revalidateCatalog()
    return { ok: true }
  })
}

export async function reorderCategories(list: string[]): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const error = await applyOrder(session, 'categories', ids.parse(list))
    if (error) return dbFailed(error, 'ordenar categorias')
    revalidateCatalog()
    return { ok: true }
  })
}

// ---------- produtos ----------

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const parsed = productSchema.safeParse(formToObject(formData))
    if (!parsed.success) return validationFailed(parsed.error)
    const session = await requireAdminAction()
    const { id, price, ...fields } = parsed.data
    const row = { ...fields, price_cents: price }

    let oldImage: string | null = null
    if (id) {
      const { data: current } = await session.supabase.from('products').select('image_path').eq('id', id).single()
      oldImage = current?.image_path ?? null
      const { error } = await session.supabase.from('products').update(row).eq('id', id)
      if (error) return dbFailed(error, 'salvar produto')
    } else {
      const { error } = await session.supabase.from('products').insert({ ...row, sort_order: 999 })
      if (error) return dbFailed(error, 'criar produto')
    }

    if (oldImage && oldImage !== row.image_path) await removeImages(session, [oldImage])
    revalidateCatalog()
    redirect('/admin/produtos')
  })
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const productId = z.uuid().parse(id)
    const { data: current } = await session.supabase.from('products').select('image_path').eq('id', productId).single()
    // Pedidos antigos guardam nome e preço (snapshot), então podem continuar existindo.
    const { error } = await session.supabase.from('products').delete().eq('id', productId)
    if (error) return dbFailed(error, 'excluir produto')
    await removeImages(session, [current?.image_path])
    revalidateCatalog()
    redirect('/admin/produtos')
  })
}

export async function setProductFlag(
  id: string,
  field: 'is_active' | 'is_available',
  value: boolean,
): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const column = z.enum(['is_active', 'is_available']).parse(field)
    const { error } = await session.supabase
      .from('products')
      .update(column === 'is_active' ? { is_active: value } : { is_available: value })
      .eq('id', z.uuid().parse(id))
    if (error) return dbFailed(error, 'atualizar produto')
    revalidateCatalog()
    return { ok: true }
  })
}

export async function reorderProducts(list: string[]): Promise<ActionResult> {
  return adminAction(async () => {
    const session = await requireAdminAction()
    const error = await applyOrder(session, 'products', ids.parse(list))
    if (error) return dbFailed(error, 'ordenar produtos')
    revalidateCatalog()
    return { ok: true }
  })
}
