import type { Tables } from '@/lib/supabase/database.types'

export type CatalogProduct = Pick<
  Tables<'products'>,
  'id' | 'name' | 'description' | 'price_cents' | 'image_path' | 'is_available'
>

export type CatalogCategory = {
  id: string
  name: string
  slug: string
  products: CatalogProduct[]
}

export type ProductMap = Record<string, CatalogProduct>

export function toProductMap(categories: CatalogCategory[]): ProductMap {
  const map: ProductMap = {}
  for (const c of categories) for (const p of c.products) map[p.id] = p
  return map
}
