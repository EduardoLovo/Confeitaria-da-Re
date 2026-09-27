import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireAdminPage } from '@/lib/auth'
import { ProductForm } from '../product-form'

export const metadata: Metadata = { title: 'Novo produto' }

export default async function NewProductPage({ searchParams }: PageProps<'/admin/produtos/novo'>) {
  const { supabase } = await requireAdminPage()
  const { categoria } = await searchParams
  const { data: categories, error } = await supabase.from('categories').select('id, name').order('sort_order')
  if (error) throw new Error(error.message)
  if (categories.length === 0) redirect('/admin/produtos')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-cocoa">Novo produto</h1>
      <ProductForm categories={categories} defaultCategoryId={typeof categoria === 'string' ? categoria : undefined} />
    </div>
  )
}
