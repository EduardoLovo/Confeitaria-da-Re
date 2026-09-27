import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { requireAdminPage } from '@/lib/auth'
import { FlavorForm } from '../flavor-form'

export const metadata: Metadata = { title: 'Editar sabor' }

export default async function EditFlavorPage({ params }: PageProps<'/admin/encomendas/sabores/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const { supabase } = await requireAdminPage()

  const { data: flavor, error } = await supabase
    .from('custom_flavors')
    .select('id, name, description, image_path, highlights, is_active')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!flavor) notFound()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-cocoa">Editar sabor</h1>
      <FlavorForm flavor={flavor} />
    </div>
  )
}
