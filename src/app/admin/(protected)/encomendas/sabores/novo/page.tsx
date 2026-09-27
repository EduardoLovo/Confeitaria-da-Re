import type { Metadata } from 'next'

import { requireAdminPage } from '@/lib/auth'
import { FlavorForm } from '../flavor-form'

export const metadata: Metadata = { title: 'Novo sabor' }

export default async function NewFlavorPage() {
  await requireAdminPage()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-cocoa">Novo sabor</h1>
      <FlavorForm />
    </div>
  )
}
