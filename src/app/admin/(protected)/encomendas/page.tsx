import { Pencil, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Toggle } from '@/components/admin/toggle'
import { ReorderButtons } from '@/components/admin/reorder-buttons'
import { Button } from '@/components/ui/button'
import { requireAdminPage } from '@/lib/auth'
import { reorderFlavors, setFlavorActive } from './actions'
import { GalleryManager } from './gallery-manager'

export const metadata: Metadata = { title: 'Encomendas' }

export default async function CustomOrdersAdminPage() {
  const { supabase } = await requireAdminPage()
  const [flavors, gallery] = await Promise.all([
    supabase.from('custom_flavors').select('id, name, highlights, is_active').order('sort_order').order('name'),
    supabase
      .from('custom_gallery')
      .select('id, image_path, caption, is_active')
      .order('sort_order')
      .order('created_at', { ascending: false }),
  ])
  if (flavors.error) throw new Error(flavors.error.message)
  if (gallery.error) throw new Error(gallery.error.message)
  const flavorIds = flavors.data.map((f) => f.id)

  return (
    <div className="flex flex-col gap-8">
      <p className="rounded-2xl bg-secondary/70 p-3 text-sm">
        O texto de apresentação, a quantidade mínima e a antecedência ficam em{' '}
        <Link href="/admin/configuracoes#encomendas" className="font-semibold underline">
          Configurações
        </Link>
        .
      </p>

      <section aria-labelledby="h-sabores" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 id="h-sabores" className="text-2xl font-semibold text-cocoa">
            Sabores
          </h1>
          <Button size="lg" nativeButton={false} render={<Link href="/admin/encomendas/sabores/novo" />}>
            <Plus /> Novo sabor
          </Button>
        </div>
        {flavors.data.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum sabor cadastrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {flavors.data.map((flavor, index) => (
              <li
                key={flavor.id}
                className={`flex items-center gap-3 rounded-2xl border bg-card p-3 ${flavor.is_active ? '' : 'opacity-60'}`}
              >
                <ReorderButtons ids={flavorIds} index={index} label={flavor.name} onReorder={reorderFlavors} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{flavor.name}</p>
                  {flavor.highlights.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">{flavor.highlights.join(' · ')}</p>
                  )}
                </div>
                <Toggle
                  checked={flavor.is_active}
                  label={`Mostrar sabor ${flavor.name}`}
                  onChange={setFlavorActive.bind(null, flavor.id)}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={<Link href={`/admin/encomendas/sabores/${flavor.id}`} />}
                  aria-label={`Editar ${flavor.name}`}
                >
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="h-galeria" className="flex flex-col gap-3">
        <h2 id="h-galeria" className="text-2xl font-semibold text-cocoa">
          Galeria de trabalhos
        </h2>
        <GalleryManager photos={gallery.data} />
      </section>
    </div>
  )
}
