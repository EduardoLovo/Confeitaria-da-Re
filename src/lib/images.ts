import { publicEnv } from '@/lib/env'

export const IMAGES_BUCKET = 'images'

/** Caminho no bucket → URL pública servida pelo Supabase Storage. */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${IMAGES_BUCKET}/${path}`
}
