import 'server-only'

import { connection } from 'next/server'

import type { Tables } from '@/lib/supabase/database.types'
import { createPublicClient } from '@/lib/supabase/public'

export type Flavor = Pick<Tables<'custom_flavors'>, 'id' | 'name' | 'description' | 'image_path' | 'highlights'>
export type GalleryPhoto = Pick<Tables<'custom_gallery'>, 'id' | 'image_path' | 'caption'>

/** Sabores e fotos da galeria das encomendas (só os ativos, via RLS). */
export async function getCustomOrderContent(): Promise<{ flavors: Flavor[]; gallery: GalleryPhoto[] }> {
  await connection()
  const supabase = createPublicClient()

  const [flavors, gallery] = await Promise.all([
    supabase
      .from('custom_flavors')
      .select('id, name, description, image_path, highlights')
      .order('sort_order')
      .order('name'),
    supabase
      .from('custom_gallery')
      .select('id, image_path, caption')
      .order('sort_order')
      .order('created_at', { ascending: false }),
  ])

  if (flavors.error) throw new Error(`sabores: ${flavors.error.message}`)
  if (gallery.error) throw new Error(`galeria: ${gallery.error.message}`)
  return { flavors: flavors.data, gallery: gallery.data }
}
