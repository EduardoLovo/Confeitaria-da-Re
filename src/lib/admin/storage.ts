import 'server-only'

import type { AdminSession } from '@/lib/auth'
import { IMAGES_BUCKET } from '@/lib/images'

/** Apaga fotos que deixaram de ser usadas. Falha aqui não deve quebrar o salvamento. */
export async function removeImages(session: AdminSession, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p))
  if (list.length === 0) return
  const { error } = await session.supabase.storage.from(IMAGES_BUCKET).remove(list)
  if (error) console.error('[storage] não foi possível apagar', list, error)
}

/** Grava sort_order = posição na lista recebida. */
export async function applyOrder(
  session: AdminSession,
  table: 'categories' | 'products' | 'delivery_zones' | 'custom_flavors' | 'custom_gallery',
  ids: string[],
) {
  const results = await Promise.all(
    ids.map((id, index) => session.supabase.from(table).update({ sort_order: index + 1 }).eq('id', id)),
  )
  return results.find((r) => r.error)?.error ?? null
}
