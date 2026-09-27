import 'server-only'

import { connection } from 'next/server'

import type { CatalogCategory, CatalogProduct } from '@/lib/domain/catalog'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * Categorias ativas com seus produtos ativos, já ordenados.
 * O RLS garante que o público só enxerga o que está ativo.
 */
export async function getCatalog(): Promise<CatalogCategory[]> {
  await connection()
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('categories')
    .select(
      'id, name, slug, products (id, name, description, price_cents, image_path, is_available)',
    )
    .order('sort_order')
    .order('name')
    .order('sort_order', { referencedTable: 'products' })
    .order('name', { referencedTable: 'products' })

  if (error) throw new Error(`catálogo: ${error.message}`)

  return data
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      products: c.products satisfies CatalogProduct[],
    }))
    .filter((c) => c.products.length > 0)
}
