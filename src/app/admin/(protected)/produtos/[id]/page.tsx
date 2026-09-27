import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { requireAdminPage } from '@/lib/auth'
import { ProductForm } from '../product-form'

export const metadata: Metadata = { title: 'Editar produto' }

export default async function EditProductPage({ params }: PageProps<'/admin/produtos/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const { supabase } = await requireAdminPage()

  const [product, categories] = await Promise.all([
    supabase
      .from('products')
      .select('id, category_id, name, description, price_cents, image_path, is_active, is_available')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('categories').select('id, name').order('sort_order'),
  ])
  if (product.error) throw new Error(product.error.message)
  if (categories.error) throw new Error(categories.error.message)
  if (!product.data) notFound()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-cocoa">Editar produto</h1>
      <ProductForm categories={categories.data} product={product.data} />
    </div>
  )
}
